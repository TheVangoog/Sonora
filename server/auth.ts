// Passwords (scrypt) and login sessions (random token in an httpOnly cookie;
// only its SHA-256 is stored, so a leaked database does not log anyone in).
// Everything lives in the database: a serverless function keeps no memory.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { one, run } from "./db.ts";
import type { Db } from "./db.ts";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
export const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;
const BLOCK_MS = 15 * 60_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(db: Db, userId: number, now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await run(db, "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", hashToken(token), userId, now + SESSION_DAYS * 86_400_000);
  return token;
}

export async function userOfSession(db: Db, token: string | undefined, now = Date.now()): Promise<number | null> {
  if (!token) return null;
  const row = await one<{ user_id: number; expires_at: number }>(
    db,
    "SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?",
    hashToken(token),
  );
  if (!row) return null;
  if (Number(row.expires_at) < now) {
    await endSession(db, token);
    return null;
  }
  return Number(row.user_id);
}

export async function endSession(db: Db, token: string): Promise<void> {
  await run(db, "DELETE FROM auth_sessions WHERE token_hash = ?", hashToken(token));
}

// ---------- Wrong passwords: after `limit` in a row, wait 15 minutes ----------

export async function isBlocked(db: Db, key: string, now = Date.now()): Promise<boolean> {
  const row = await one<{ blocked_until: number }>(db, "SELECT blocked_until FROM login_failures WHERE key = ?", key);
  return Number(row?.blocked_until ?? 0) > now;
}

export async function recordFailure(db: Db, key: string, limit: number, now = Date.now()): Promise<void> {
  await run(
    db,
    `INSERT INTO login_failures (key, count, blocked_until) VALUES (?, 1, 0)
     ON CONFLICT(key) DO UPDATE SET count = count + 1`,
    key,
  );
  await run(db, "UPDATE login_failures SET count = 0, blocked_until = ? WHERE key = ? AND count >= ?", now + BLOCK_MS, key, limit);
}

export async function clearFailures(db: Db, key: string): Promise<void> {
  await run(db, "DELETE FROM login_failures WHERE key = ?", key);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
