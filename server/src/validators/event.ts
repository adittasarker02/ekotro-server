import { z } from "zod";
import { EVENT_TYPES } from "../types/index.js";

/** http(s) link, or a path on the client site such as /photos/1-donation.jpg */
function isImageSource(value: string): boolean {
  if (/^\/[^/\\\s]/.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const baseFields = {
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(100, "Title must be 100 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(30, "Description must be at least 30 characters")
    .max(2000, "Description must be 2000 characters or fewer"),
  eventType: z.enum(EVENT_TYPES, { message: "Please choose a valid event type" }),
  thumbnail: z
    .string()
    .trim()
    .min(1, "Thumbnail image URL is required")
    .max(2048, "Thumbnail URL is too long")
    .refine(isImageSource, "Thumbnail must be a valid http(s) URL or a site path such as /photos/1-donation.jpg"),
  location: z.string().trim().min(3, "Location must be at least 3 characters").max(150),
  eventDate: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Event date is not a valid date")
    .transform((v) => new Date(v)),
};

/** Creating an event: the date has to be in the future. */
export const createEventSchema = z.object(baseFields).refine((d) => d.eventDate.getTime() > Date.now(), {
  path: ["eventDate"],
  message: "Event date must be in the future",
});

/** Updating: same fields; future-date rule is enforced in the route (unchanged date is allowed). */
export const updateEventSchema = z.object(baseFields);

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(12),
  page: z.coerce.number().int().min(1).default(1),
  type: z.string().trim().optional(),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["date", "latest", "popular"]).default("date"),
});
