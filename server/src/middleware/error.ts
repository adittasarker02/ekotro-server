import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) {
      const key = i.path.join(".") || "_";
      if (!fields[key]) fields[key] = i.message;
    }
    return res.status(400).json({ message: Object.values(fields)[0] ?? "Validation failed", errors: fields });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  // body-parser errors (malformed JSON, payload too large)
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ message: (err as Error).message });
  }
  console.error("[error]", err);
  return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
}
