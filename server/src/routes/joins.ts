import { Router } from "express";
import { events, joins } from "../config/db.js";
import { getUser, requireAuth } from "../middleware/auth.js";

const router = Router();

/** GET /api/joins/mine -> events joined by the logged-in user, sorted by event date */
router.get("/mine", requireAuth, async (req, res) => {
  const user = getUser(req);
  const myJoins = await joins().find({ userEmail: user.email }).toArray();
  const live = await events()
    .find({ _id: { $in: myJoins.map((j) => j.eventId) } })
    .toArray();
  const byId = new Map(live.map((e) => [String(e._id), e]));

  const data = myJoins
    .map((j) => {
      const e = byId.get(String(j.eventId));
      return {
        _id: j._id,
        eventId: j.eventId,
        joinedAt: j.joinedAt,
        // prefer live event data, fall back to the snapshot saved when joining
        title: e?.title ?? j.event.title,
        thumbnail: e?.thumbnail ?? j.event.thumbnail,
        location: e?.location ?? j.event.location,
        eventType: e?.eventType ?? j.event.eventType,
        eventDate: e?.eventDate ?? j.event.eventDate,
        creatorName: e?.creatorName ?? "",
      };
    })
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  res.json({ data });
});

export default router;
