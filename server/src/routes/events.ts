import { Router } from "express";
import type { Filter, Sort } from "mongodb";
import { events, joins } from "../config/db.js";
import { getUser, requireAuth } from "../middleware/auth.js";
import { EVENT_TYPES, type EventDoc, type EventType } from "../types/index.js";
import { HttpError } from "../utils/httpError.js";
import { toObjectId } from "../utils/objectId.js";
import { createEventSchema, listQuerySchema, updateEventSchema } from "../validators/event.js";

const router = Router();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ------------------------------------------------------------------ */
/*  Public                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/events  -> upcoming events only (past events are never returned) */
router.get("/", async (req, res) => {
  const q = listQuerySchema.parse(req.query);

  const filter: Filter<EventDoc> = { eventDate: { $gte: new Date() } };
  if (q.type && q.type !== "all") {
    if (!EVENT_TYPES.includes(q.type as EventType)) throw new HttpError(400, "Unknown event type");
    filter.eventType = q.type as EventType;
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ title: rx }, { location: rx }, { description: rx }];
  }

  const sort: Sort =
    q.sort === "latest"
      ? { createdAt: -1 }
      : q.sort === "popular"
        ? { participantsCount: -1, eventDate: 1 }
        : { eventDate: 1 };

  const [data, total] = await Promise.all([
    events()
      .find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .toArray(),
    events().countDocuments(filter),
  ]);

  res.json({ data, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) });
});

/** GET /api/events/stats -> small numbers for the home page */
router.get("/stats", async (_req, res) => {
  const now = new Date();
  const [upcoming, totalEvents, volunteers] = await Promise.all([
    events().countDocuments({ eventDate: { $gte: now } }),
    events().countDocuments(),
    joins().countDocuments(),
  ]);
  res.json({ upcoming, totalEvents, volunteers });
});

/* ------------------------------------------------------------------ */
/*  Private (JWT)                                                      */
/* ------------------------------------------------------------------ */

/** GET /api/events/mine -> events created by the logged-in user */
router.get("/mine", requireAuth, async (req, res) => {
  const user = getUser(req);
  const data = await events().find({ creatorEmail: user.email }).sort({ eventDate: 1 }).toArray();
  res.json({ data });
});

router.post("/", requireAuth, async (req, res) => {
  const user = getUser(req);
  const body = createEventSchema.parse(req.body);
  const now = new Date();
  const doc: Omit<EventDoc, "_id"> = {
    ...body,
    creatorEmail: user.email,
    creatorName: user.name,
    creatorId: user.id,
    participantsCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const result = await events().insertOne(doc as EventDoc);
  res.status(201).json({ message: "Event created successfully", data: { _id: result.insertedId, ...doc } });
});

/* ------------------------------------------------------------------ */
/*  Single event                                                       */
/* ------------------------------------------------------------------ */

router.get("/:id", async (req, res) => {
  const event = await events().findOne({ _id: toObjectId(req.params.id) });
  if (!event) throw new HttpError(404, "Event not found");
  res.json({ data: event });
});

router.put("/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  const _id = toObjectId(req.params.id);
  const existing = await events().findOne({ _id });
  if (!existing) throw new HttpError(404, "Event not found");
  if (existing.creatorEmail !== user.email) throw new HttpError(403, "You can only update events you created");

  const body = updateEventSchema.parse(req.body);
  const dateChanged = body.eventDate.getTime() !== existing.eventDate.getTime();
  if (dateChanged && body.eventDate.getTime() <= Date.now()) {
    throw new HttpError(400, "Event date must be in the future");
  }

  const updatedAt = new Date();
  await events().updateOne({ _id }, { $set: { ...body, updatedAt } });
  // keep the snapshot stored with each join in sync
  await joins().updateMany(
    { eventId: _id },
    {
      $set: {
        event: {
          title: body.title,
          thumbnail: body.thumbnail,
          location: body.location,
          eventType: body.eventType,
          eventDate: body.eventDate,
        },
      },
    },
  );
  const data = await events().findOne({ _id });
  res.json({ message: "Event updated successfully", data });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  const _id = toObjectId(req.params.id);
  const existing = await events().findOne({ _id });
  if (!existing) throw new HttpError(404, "Event not found");
  if (existing.creatorEmail !== user.email) throw new HttpError(403, "You can only delete events you created");

  await events().deleteOne({ _id });
  await joins().deleteMany({ eventId: _id });
  res.json({ message: "Event deleted successfully" });
});

/* ------------------------------------------------------------------ */
/*  Joining                                                            */
/* ------------------------------------------------------------------ */

router.get("/:id/join-status", requireAuth, async (req, res) => {
  const user = getUser(req);
  const exists = await joins().countDocuments({ eventId: toObjectId(req.params.id), userEmail: user.email }, { limit: 1 });
  res.json({ joined: exists > 0 });
});

router.post("/:id/join", requireAuth, async (req, res) => {
  const user = getUser(req);
  const _id = toObjectId(req.params.id);
  const event = await events().findOne({ _id });
  if (!event) throw new HttpError(404, "Event not found");
  if (event.eventDate.getTime() <= Date.now()) throw new HttpError(400, "This event has already taken place");

  try {
    await joins().insertOne({
      eventId: _id,
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      userImage: user.image,
      event: {
        title: event.title,
        thumbnail: event.thumbnail,
        location: event.location,
        eventType: event.eventType,
        eventDate: event.eventDate,
      },
      joinedAt: new Date(),
    } as never);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, "You have already joined this event");
    throw err;
  }

  const updated = await events().findOneAndUpdate({ _id }, { $inc: { participantsCount: 1 } }, { returnDocument: "after" });
  res.status(201).json({ message: "You have joined this event", participantsCount: updated?.participantsCount ?? 0 });
});

router.delete("/:id/join", requireAuth, async (req, res) => {
  const user = getUser(req);
  const _id = toObjectId(req.params.id);
  const result = await joins().deleteOne({ eventId: _id, userEmail: user.email });
  if (result.deletedCount === 0) throw new HttpError(404, "You have not joined this event");
  const updated = await events().findOneAndUpdate({ _id }, { $inc: { participantsCount: -1 } }, { returnDocument: "after" });
  res.json({ message: "You have left this event", participantsCount: Math.max(0, updated?.participantsCount ?? 0) });
});

export default router;
