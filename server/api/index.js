let app;
let createAppFn;
let connectDB;
let loadError;

try {
  ({ createApp: createAppFn } = require("../dist/app.js"));
  ({ connectDB } = require("../dist/config/db.js"));
  app = createAppFn();
} catch (err) {
  loadError = err;
  console.error("Failed to start the API:", err);
}

module.exports = async function handler(req, res) {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Server configuration error. Check the environment variables and the Vercel function logs." }));
    return;
  }
  try {
    await connectDB();
  } catch (err) {
    console.error("Database connection failed:", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Database is unavailable. Please try again shortly." }));
    return;
  }
  return app(req, res);
};
