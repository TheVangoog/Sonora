// Local API server. Env: PORT (default 3001), DATABASE_URL (default
// file:server/data/sonora.db) or TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Run: npm run server   (npm run dev forwards /api here)
import { mkdirSync } from "node:fs";
import { createApp } from "./app.ts";
import { databaseConfig } from "./config.ts";
import { openDb } from "./db.ts";

const port = Number(process.env.PORT ?? 3001);
const { url, authToken } = databaseConfig();
if (url.startsWith("file:")) mkdirSync("server/data", { recursive: true });

const app = createApp(await openDb(url, authToken), { secureCookie: process.env.NODE_ENV === "production" });
app.listen(port, () => console.log(`Sonora API on http://localhost:${port} (database ${url.split("?")[0]})`));
