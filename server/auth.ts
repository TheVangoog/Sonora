// Passwords (scrypt) and login sessions (random token in an httpOnly cookie;
// only its SHA-256 is stored, so a leaked database does not log anyone in).
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "./db.ts";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
export const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;

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

export function startSession(db: Db, userId: number, now = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    now + SESSION_DAYS * 86_400_000,
  );
  return token;
}

export function userOfSession(db: Db, token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const row = db.prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?").get(hashToken(token)) as
    | { user_id: number; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < now) {
    endSession(db, token);
    return null;
  }
  return row.user_id;
}

export function endSession(db: Db, token: string): void {
  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(hashToken(token));
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
