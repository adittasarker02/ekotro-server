import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env.js";
import type { EventDoc, JoinDoc } from "../types/index.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;
  const next = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    await next.connect();
    const database = next.db(env.DB_NAME);
    await ensureIndexes(database);
    client = next;
    db = database;
    return database;
  } catch (err) {
    await next.close().catch(() => undefined); // do not leak a half-open client; the next request retries
    throw err;
  }
}

export async function pingDB(): Promise<void> {
  await getDB().command({ ping: 1 });
}

export async function closeDB(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

function getDB(): Db {
  if (!db) throw new Error("Database not initialised. Call connectDB() first.");
  return db;
}

// Test hook: lets the test-suite swap the real collections for an in-memory double.
let override: { events?: unknown; joins?: unknown } = {};
export function __useTestCollections(c: { events: unknown; joins: unknown }) {
  override = c;
}

export const events = (): Collection<EventDoc> =>
  (override.events as Collection<EventDoc> | undefined) ?? getDB().collection<EventDoc>("events");
export const joins = (): Collection<JoinDoc> =>
  (override.joins as Collection<JoinDoc> | undefined) ?? getDB().collection<JoinDoc>("joins");

async function ensureIndexes(database: Db) {
  const ev = database.collection<EventDoc>("events");
  const jn = database.collection<JoinDoc>("joins");
  await Promise.all([
    ev.createIndex({ eventDate: 1 }),
    ev.createIndex({ creatorEmail: 1, eventDate: 1 }),
    ev.createIndex({ eventType: 1 }),
    ev.createIndex({ title: "text", location: "text" }),
    // a user can join an event only once
    jn.createIndex({ eventId: 1, userEmail: 1 }, { unique: true }),
    jn.createIndex({ userEmail: 1 }),
  ]);
}
