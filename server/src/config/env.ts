import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  DB_NAME: z.string().min(1).default("ekotro"),
  CLIENT_URL: z.string().min(1, "CLIENT_URL is required"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  // on Vercel there is no terminal to exit from: throw so the message lands in the function logs
  if (process.env.VERCEL) throw new Error("Invalid environment variables. See the log lines above.");
  process.exit(1);
}

const stripSlash = (v: string) => v.replace(/\/+$/, "");

export const env = {
  ...parsed.data,
  AUTH_URL: stripSlash(parsed.data.AUTH_URL),
  CLIENT_ORIGINS: parsed.data.CLIENT_URL.split(",")
    .map((s) => stripSlash(s.trim()))
    .filter(Boolean),
};
