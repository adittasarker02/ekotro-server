import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import type { AuthUser } from "../types/index.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * BetterAuth (running inside the Next.js app) signs JWTs with its `jwt` plugin and
 * publishes the public keys at <AUTH_URL>/api/auth/jwks. We verify every token against
 * that JWKS, so the API never needs the signing secret.
 */
const JWKS = createRemoteJWKSet(new URL(`${env.AUTH_URL}/api/auth/jwks`), {
  cooldownDuration: 10_000,
  cacheMaxAge: 10 * 60_000,
});

async function verify(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: env.AUTH_URL,
    audience: env.AUTH_URL,
  });
  const email = typeof payload.email === "string" ? payload.email : "";
  const id = typeof payload.sub === "string" ? payload.sub : typeof payload.id === "string" ? payload.id : "";
  if (!email || !id) throw new Error("Token is missing user claims");
  return {
    id,
    email: email.toLowerCase(),
    name: typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0]!,
    image: typeof payload.image === "string" ? payload.image : undefined,
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
    const token = header.slice(7).trim();
    if (!token) throw new HttpError(401, "Authentication required");
    req.user = await verify(token);
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    // jose errors (expired, bad signature, wrong issuer, JWKS unreachable ...)
    const code = (err as { code?: string }).code;
    if (code === "ERR_JWKS_TIMEOUT" || code === "ERR_JWKS_NO_MATCHING_KEY" || (err as Error).name === "TypeError") {
      console.error("[auth] could not verify token:", (err as Error).message);
    }
    next(new HttpError(401, "Invalid or expired token"));
  }
}

export function getUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, "Authentication required");
  return req.user;
}
