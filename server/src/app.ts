import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { pingDB } from "./config/db.js";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import eventsRouter from "./routes/events.js";
import joinsRouter from "./routes/joins.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / server-to-server calls (no Origin header) and the configured clients
        if (!origin || env.CLIENT_ORIGINS.includes(origin.replace(/\/+$/, ""))) return cb(null, true);
        cb(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  if (env.NODE_ENV !== "test") app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(
    "/api",
    rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false }),
  );

  app.get("/", (_req, res) => {
    res.json({ name: "Ekotro API", status: "ok", docs: "See README.md for the endpoint list" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), time: new Date().toISOString() });
  });

  /** Answers 200 only when MongoDB really responds, so you can check the database connection from a browser. */
  app.get("/api/health/db", async (_req, res) => {
    try {
      await pingDB();
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(503).json({ status: "error", database: "not connected" });
    }
  });

  app.use("/api/events", eventsRouter);
  app.use("/api/joins", joinsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
