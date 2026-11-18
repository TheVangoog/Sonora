// libSQL (SQLite-compatible): a local file for development and tests, a Turso
// database in production (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
import type { Client, InValue } from "@libsql/client";

export type Db = Client;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_failures (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS practice_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    seconds REAL NOT NULL,
    notes_heard INTEGER NOT NULL DEFAULT 0,
    notes_in_tune INTEGER NOT NULL DEFAULT 0,
    sum_abs_cents REAL NOT NULL DEFAULT 0,
    chords_shown INTEGER NOT NULL DEFAULT 0,
    engine TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS practice_by_user ON practice_sessions(user_id, started_at)",
];

/**
 * Connects and makes sure the tables exist (safe to run on every start, also
 * on every cold start of the serverless function). A file: URL uses the native
 * driver; a remote libsql:// or https:// URL uses the pure-HTTP one.
 */
export async function openDb(url: string, authToken?: string): Promise<Db> {
  const { createClient } = url.startsWith("file:")
    ? await import("@libsql/client")
    : await import("@libsql/client/web");
  const db = createClient({ url, authToken });
  await db.execute("PRAGMA foreign_keys = ON");
  await db.batch(SCHEMA, "write");
  return db;
}

/** The first row of a query, or undefined. */
export async function one<T>(db: Db, sql: string, ...args: InValue[]): Promise<T | undefined> {
  const { rows } = await db.execute({ sql, args });
  return rows[0] as T | undefined;
}

export async function all<T>(db: Db, sql: string, ...args: InValue[]): Promise<T[]> {
  const { rows } = await db.execute({ sql, args });
  return rows as unknown as T[];
}

export async function run(db: Db, sql: string, ...args: InValue[]) {
  return db.execute({ sql, args });
}
