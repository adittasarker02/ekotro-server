import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSeedEvents, dhakaDate } from "../src/scripts/seedData.js";
import { EVENT_TYPES } from "../src/types/index.js";
import { updateEventSchema } from "../src/validators/event.js";

describe("seed data", () => {
  const now = new Date();
  const docs = buildSeedEvents(now);

  it("creates only valid, upcoming events", () => {
    assert.ok(docs.length >= 8);
    for (const d of docs) {
      const parsed = updateEventSchema.safeParse({ ...d, eventDate: d.eventDate.toISOString() });
      assert.ok(parsed.success, `${d.title}: ${parsed.success ? "" : parsed.error.issues[0]?.message}`);
      assert.ok(d.eventDate.getTime() > now.getTime(), `${d.title} must be in the future`);
    }
  });

  it("covers every event type and uses the shipped photos", () => {
    for (const t of EVENT_TYPES.filter((t) => t !== "Other")) assert.ok(docs.some((d) => d.eventType === t), `missing ${t}`);
    assert.ok(docs.every((d) => /^\/photos\/\d-[a-z-]+\.jpg$/.test(d.thumbnail)));
  });

  it("converts Dhaka local time to UTC correctly", () => {
    // 10:00 in Dhaka is 04:00 UTC
    assert.equal(dhakaDate(new Date("2026-11-14T12:00:00Z"), 4, 10, 0).toISOString(), "2026-11-18T04:00:00.000Z");
  });
});
