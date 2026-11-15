import { closeDB, connectDB, events, joins } from "../config/db.js";
import type { EventDoc } from "../types/index.js";
import { buildSeedEvents, SEED_EMAIL } from "./seedData.js";

/** Adds sample upcoming events. Safe to run again: it replaces only the events created by the seed account. */
async function main() {
  await connectDB();
  const old = await events().find({ creatorEmail: SEED_EMAIL }).toArray();
  if (old.length) {
    await joins().deleteMany({ eventId: { $in: old.map((e) => e._id) } });
    await events().deleteMany({ creatorEmail: SEED_EMAIL });
  }
  const docs = buildSeedEvents();
  await events().insertMany(docs as unknown as EventDoc[]);
  console.log(`Seeded ${docs.length} upcoming events (replaced ${old.length}).`);
  await closeDB();
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await closeDB().catch(() => undefined);
  process.exit(1);
});
