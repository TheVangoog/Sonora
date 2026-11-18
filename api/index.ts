// The whole API as one Vercel Function. vercel.json sends every /api/* request
// here; Express routes it by the original path. The database connection and
// the tables are set up once per cold start.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app.ts";
import { databaseConfig } from "../server/config.ts";
import { openDb } from "../server/db.ts";

let app: Promise<ReturnType<typeof createApp>> | null = null;

function getApp() {
  app ??= (async () => {
    const { url, authToken } = databaseConfig();
    return createApp(await openDb(url, authToken), { secureCookie: true });
  })();
  app.catch(() => (app = null)); // try again on the next request
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    (await getApp())(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "The API is not configured: " + (error instanceof Error ? error.message : "unknown error") }));
  }
}
