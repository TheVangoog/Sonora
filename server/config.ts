// Where the database is. Production (Vercel): the Turso database from the
// project's environment variables. Locally and in tests: a SQLite file.
export function databaseConfig(env = process.env): { url: string; authToken?: string } {
  if (env.TURSO_DATABASE_URL) return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
  if (env.VERCEL) throw new Error("TURSO_DATABASE_URL is not set in the Vercel project.");
  return { url: env.DATABASE_URL ?? "file:server/data/sonora.db" };
}
