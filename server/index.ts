// Starts the API. Env: PORT (default 3001), DATABASE_PATH (default
// server/data/sonora.db), NODE_ENV=production for Secure cookies.
// Run: npm run server
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.DATABASE_PATH ?? "server/data/sonora.db";
mkdirSync(dirname(dbPath), { recursive: true });

const app = createApp(openDb(dbPath), { secureCookie: process.env.NODE_ENV === "production" });
app.listen(port, () => console.log(`Sonora API on http://localhost:${port} (database ${dbPath})`));
