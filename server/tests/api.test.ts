import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { FakeCollection } from "./fakeCollection.js";

let authServer: Server;
let apiServer: Server;
let base = "";
let authUrl = "";
let privateKey: CryptoKey;

async function token(user: { id: string; email: string; name: string }, opts: { aud?: string; expired?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setSubject(user.id)
    .setIssuer(authUrl)
    .setAudience(opts.aud ?? authUrl)
    .setIssuedAt(now - (opts.expired ? 7200 : 0))
    .setExpirationTime(now + (opts.expired ? -3600 : 900))
    .sign(privateKey);
}

const alice = { id: "u1", email: "alice@test.dev", name: "Alice" };
const bob = { id: "u2", email: "bob@test.dev", name: "Bob" };

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const validEvent = (over: Record<string, unknown> = {}) => ({
  title: "Winter Clothes Distribution",
  description: "We are collecting and distributing warm clothes to families in need around Mirpur 10.",
  eventType: "Donation",
  thumbnail: "https://example.com/photo.jpg",
  location: "Mirpur 10, Dhaka",
  eventDate: future(5),
  ...over,
});

before(async () => {
  const { publicKey, privateKey: pk } = await generateKeyPair("EdDSA", { extractable: true });
  privateKey = pk;
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "EdDSA" };
  authServer = createServer((req, res) => {
    if (req.url === "/api/auth/jwks") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ keys: [jwk] }));
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((r) => authServer.listen(0, "127.0.0.1", r));
  authUrl = `http://127.0.0.1:${(authServer.address() as AddressInfo).port}`;

  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = "mongodb://unused";
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.AUTH_URL = authUrl;

  const { __useTestCollections } = await import("../src/config/db.js");
  __useTestCollections({ events: new FakeCollection(), joins: new FakeCollection(["eventId", "userEmail"]) });
  const { createApp } = await import("../src/app.js");
  apiServer = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => apiServer.once("listening", r));
  base = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
});

after(() => {
  apiServer?.close();
  authServer?.close();
});

describe("auth / JWT", () => {
  it("rejects requests without a token", async () => {
    assert.equal((await call("POST", "/api/events", { body: validEvent() })).status, 401);
  });
  it("rejects a garbage token", async () => {
    assert.equal((await call("GET", "/api/events/mine", { token: "abc.def.ghi" })).status, 401);
  });
  it("rejects an expired token", async () => {
    const t = await token(alice, { expired: true });
    assert.equal((await call("GET", "/api/events/mine", { token: t })).status, 401);
  });
  it("rejects a token for another audience", async () => {
    const t = await token(alice, { aud: "https://evil.example" });
    assert.equal((await call("GET", "/api/events/mine", { token: t })).status, 401);
  });
});

describe("events", () => {
  let aliceToken = "";
  let bobToken = "";
  let eventId = "";

  before(async () => {
    aliceToken = await token(alice);
    bobToken = await token(bob);
  });

  it("validates the create form (past date, short title, bad URL)", async () => {
    const past = await call("POST", "/api/events", { token: aliceToken, body: validEvent({ eventDate: new Date(Date.now() - 86_400_000).toISOString() }) });
    assert.equal(past.status, 400);
    assert.match(past.json.message, /future/i);
    const short = await call("POST", "/api/events", { token: aliceToken, body: validEvent({ title: "Hi" }) });
    assert.equal(short.status, 400);
    const badUrl = await call("POST", "/api/events", { token: aliceToken, body: validEvent({ thumbnail: "not a url" }) });
    assert.equal(badUrl.status, 400);
    const badType = await call("POST", "/api/events", { token: aliceToken, body: validEvent({ eventType: "Party" }) });
    assert.equal(badType.status, 400);
  });

  it("creates an event and stores the creator email", async () => {
    const r = await call("POST", "/api/events", { token: aliceToken, body: validEvent() });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.creatorEmail, alice.email);
    eventId = r.json.data._id;
  });

  it("lists only upcoming events publicly", async () => {
    // an event that already happened (inserted directly, as the API refuses past dates)
    const { events } = await import("../src/config/db.js");
    await events().insertOne({ ...validEvent({ title: "Old cleanup drive" }), eventDate: new Date(Date.now() - 86_400_000), creatorEmail: alice.email, participantsCount: 0, createdAt: new Date() } as never);
    const r = await call("GET", "/api/events?limit=6");
    assert.equal(r.status, 200);
    assert.ok(r.json.data.length >= 1);
    assert.ok(r.json.data.every((e: any) => new Date(e.eventDate) >= new Date()));
    assert.ok(!r.json.data.some((e: any) => e.title === "Old cleanup drive"));
  });

  it("filters by type and search", async () => {
    assert.equal((await call("GET", "/api/events?type=Plantation")).json.data.length, 0);
    assert.equal((await call("GET", "/api/events?type=Donation")).json.data.length, 1);
    assert.equal((await call("GET", "/api/events?search=mirpur")).json.data.length, 1);
    assert.equal((await call("GET", "/api/events?type=Nope")).status, 400);
  });

  it("returns a single event publicly and 404/400 for bad ids", async () => {
    assert.equal((await call("GET", `/api/events/${eventId}`)).status, 200);
    assert.equal((await call("GET", "/api/events/64b7f0f0f0f0f0f0f0f0f0f0")).status, 404);
    assert.equal((await call("GET", "/api/events/not-an-id")).status, 400);
  });

  it("only the owner can update or delete", async () => {
    const upd = await call("PUT", `/api/events/${eventId}`, { token: bobToken, body: validEvent({ title: "Hijacked title" }) });
    assert.equal(upd.status, 403);
    const del = await call("DELETE", `/api/events/${eventId}`, { token: bobToken });
    assert.equal(del.status, 403);
    const ok = await call("PUT", `/api/events/${eventId}`, { token: aliceToken, body: validEvent({ title: "Winter Clothes Drive 2026", eventDate: future(6) }) });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.data.title, "Winter Clothes Drive 2026");
  });

  it("manages my events list", async () => {
    const mine = await call("GET", "/api/events/mine", { token: aliceToken });
    assert.equal(mine.json.data.length, 2); // the upcoming one + the old one inserted above
    assert.equal((await call("GET", "/api/events/mine", { token: bobToken })).json.data.length, 0);
  });

  it("join flow: must be logged in, only once, count updates, sorted by date", async () => {
    assert.equal((await call("POST", `/api/events/${eventId}/join`)).status, 401);
    const j = await call("POST", `/api/events/${eventId}/join`, { token: bobToken });
    assert.equal(j.status, 201);
    assert.equal(j.json.participantsCount, 1);
    assert.equal((await call("POST", `/api/events/${eventId}/join`, { token: bobToken })).status, 409);
    assert.equal((await call("GET", `/api/events/${eventId}/join-status`, { token: bobToken })).json.joined, true);
    assert.equal((await call("GET", `/api/events/${eventId}/join-status`, { token: aliceToken })).json.joined, false);

    const second = await call("POST", "/api/events", { token: aliceToken, body: validEvent({ title: "Tree plantation day", eventType: "Plantation", eventDate: future(2) }) });
    await call("POST", `/api/events/${second.json.data._id}/join`, { token: bobToken });
    const mine = await call("GET", "/api/joins/mine", { token: bobToken });
    assert.equal(mine.json.data.length, 2);
    assert.equal(mine.json.data[0].title, "Tree plantation day"); // earlier date first
    assert.equal((await call("GET", `/api/events/${eventId}`)).json.data.participantsCount, 1);
  });

  it("cannot join a past event", async () => {
    const { events } = await import("../src/config/db.js");
    const { insertedId } = await events().insertOne({ ...validEvent(), eventDate: new Date(Date.now() - 1000), creatorEmail: alice.email, participantsCount: 0 } as never);
    assert.equal((await call("POST", `/api/events/${insertedId}/join`, { token: bobToken })).status, 400);
  });

  it("deleting an event removes the joins", async () => {
    assert.equal((await call("DELETE", `/api/events/${eventId}`, { token: aliceToken })).status, 200);
    assert.equal((await call("GET", `/api/events/${eventId}`)).status, 404);
    const mine = await call("GET", "/api/joins/mine", { token: bobToken });
    assert.ok(!mine.json.data.some((j: any) => j.eventId === eventId));
  });

  it("reports the database as not connected when there is no connection", async () => {
    const r = await call("GET", "/api/health/db");
    assert.equal(r.status, 503);
    assert.equal(r.json.database, "not connected");
  });

  it("answers unknown routes with JSON 404", async () => {
    const r = await call("GET", "/api/nothing");
    assert.equal(r.status, 404);
    assert.ok(r.json.message);
  });
});
