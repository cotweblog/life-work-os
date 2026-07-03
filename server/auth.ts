import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Gates every request behind HTTP Basic Auth when APP_PASSWORD is set.
// Username is ignored — this is a single shared password, not a user system.
// With no APP_PASSWORD configured (e.g. local dev), the gate is a no-op.
export function requireAppPassword(req: Request, res: Response, next: NextFunction) {
  const password = process.env.APP_PASSWORD;
  if (!password) return next();

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const suppliedPassword = sep >= 0 ? decoded.slice(sep + 1) : decoded;
    if (safeEqual(suppliedPassword, password)) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Life Work OS"');
  res.status(401).send("Authentication required");
}
