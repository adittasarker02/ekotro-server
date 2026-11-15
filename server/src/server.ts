import { createApp } from "./app.js";
import { closeDB, connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function main() {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Ekotro API running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
