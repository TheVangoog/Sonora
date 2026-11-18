// SQLite through Node's built-in node:sqlite: one file, no native packages.
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS practice_sessions (
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
);
CREATE INDEX IF NOT EXISTS practice_by_user ON practice_sessions(user_id, started_at);
`;

/** ":memory:" for tests, a file path otherwise. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}
