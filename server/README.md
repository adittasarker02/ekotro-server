# Ekotro API

Express + TypeScript + MongoDB REST API for [Ekotro](../client). Private routes are protected with JWTs issued by BetterAuth (running in the Next.js client) and verified here against its JWKS (`<AUTH_URL>/api/auth/jwks`) — the API never needs the signing secret.

## Run locally

```bash
npm install
cp .env.example .env     # fill in MONGODB_URI etc.
npm run dev              # http://localhost:5000
npm run check:db         # tells you if MongoDB is connected (and how to fix it if not)
npm run seed             # adds 10 sample upcoming events (safe to run again)
npm test                 # API tests (JWT + routes, in-memory collections)
npm run build && npm start
```

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI`, `DB_NAME` | MongoDB connection |
| `CLIENT_URL` | Allowed CORS origin(s), comma separated |
| `AUTH_URL` | URL of the Next.js app; JWT issuer/audience. Must equal `BETTER_AUTH_URL` in the client |

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | – | Health check |
| GET | `/api/health/db` | – | `200` only when MongoDB is connected, else `503` |
| GET | `/api/events` | – | Upcoming events. Query: `limit`, `page`, `type`, `search`, `sort=date\|popular\|latest` |
| GET | `/api/events/stats` | – | Counts for the home page |
| GET | `/api/events/:id` | – | Single event |
| POST | `/api/events` | JWT | Create event (future date required) |
| GET | `/api/events/mine` | JWT | Events created by me |
| PUT | `/api/events/:id` | JWT, owner | Update event |
| DELETE | `/api/events/:id` | JWT, owner | Delete event (and its joins) |
| POST | `/api/events/:id/join` | JWT | Join an event (once per user) |
| DELETE | `/api/events/:id/join` | JWT | Leave an event |
| GET | `/api/events/:id/join-status` | JWT | Did I join? |
| GET | `/api/joins/mine` | JWT | Events I joined, sorted by event date |

Collections: `events` (includes `creatorEmail`), `joins` (event + user data, unique on `eventId + userEmail`).

## Deploy to Vercel

`api/[...slug].js` and `vercel.json` already make this project Vercel-ready (Express runs as a serverless function).

```bash
npm i -g vercel
vercel login
vercel                      # first run: answer the prompts (framework: Other)
vercel env add MONGODB_URI production
vercel env add DB_NAME production          # ekotro
vercel env add CLIENT_URL production       # https://YOUR-CLIENT.vercel.app
vercel env add AUTH_URL production         # https://YOUR-CLIENT.vercel.app  (same as BETTER_AUTH_URL)
vercel --prod
```

Open `https://YOUR-SERVER.vercel.app/api/health`. It should answer `{"status":"ok",...}`.

If you deploy the server before the client exists, use a placeholder for `CLIENT_URL`/`AUTH_URL`, then update both after the client is live (`vercel env rm` + `vercel env add`) and run `vercel --prod` again.

Seed sample events into the production database from your own computer: put the production `MONGODB_URI` in `.env`, then `npm run seed`.

Allow `0.0.0.0/0` in MongoDB Atlas > Network Access, because Vercel uses changing IP addresses.

## Deploy to Render (alternative)

New *Web Service*: build `npm install --include=dev && npm run build`, start `npm start`, add the env variables above. `render.yaml` is included.
