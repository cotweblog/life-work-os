import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  windowStart: number;
}

// In-memory is fine here: single instance, and a restart clearing counters
// isn't a meaningful security regression for this use case.
const failuresByIp = new Map<string, AttemptRecord>();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isLockedOut(ip: string): boolean {
  const record = failuresByIp.get(ip);
  if (!record) return false;
  if (Date.now() - record.windowStart > WINDOW_MS) {
    failuresByIp.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const record = failuresByIp.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    failuresByIp.set(ip, { count: 1, windowStart: now });
  } else {
    record.count++;
  }
}

// Gates every request behind HTTP Basic Auth when APP_PASSWORD is set.
// Username is ignored — this is a single shared password, not a user system.
// With no APP_PASSWORD configured (e.g. local dev), the gate is a no-op.
export function requireAppPassword(req: Request, res: Response, next: NextFunction) {
  const password = process.env.APP_PASSWORD;
  if (!password) return next();

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (isLockedOut(ip)) {
    res.set("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).send("Too many failed login attempts. Try again in 15 minutes.");
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const suppliedPassword = sep >= 0 ? decoded.slice(sep + 1) : decoded;
    if (safeEqual(suppliedPassword, password)) {
      failuresByIp.delete(ip);
      return next();
    }
    // A password was actually supplied and it was wrong — that's a real guess attempt.
    recordFailure(ip);
  }
  // No Authorization header at all just means the browser hasn't prompted yet
  // (normal first request of the Basic Auth handshake) — don't penalize that.

  res.set("WWW-Authenticate", 'Basic realm="Life Work OS"');
  res.status(401).send("Authentication required");
}
