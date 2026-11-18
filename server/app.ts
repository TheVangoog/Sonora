// The REST API. In production it runs as one Vercel Function in the same
// project as the frontend (api/index.ts), so /api/* is on the site's own
// domain and the login cookie is first-party. Locally: npm run server.
import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  checkPassword,
  clearFailures,
  endSession,
  hashPassword,
  isBlocked,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  recordFailure,
  SESSION_DAYS,
  startSession,
  userOfSession,
} from "./auth.ts";
import { all, one, run } from "./db.ts";
import type { Db } from "./db.ts";
import { parseSettings } from "../src/settings/settingsStore.ts";
import { parsePracticeSession, PRACTICE_PAGES } from "../src/stats/practice.ts";
import type { PracticeSummary } from "../src/stats/practice.ts";

export const COOKIE = "sonora_session";

// A hash to compare against when the email is unknown, so both cases take as long.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not a real password"));

type Options = { secureCookie: boolean; loginLimit?: number };

export function createApp(db: Db, { secureCookie, loginLimit = 10 }: Options) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Vercel's proxy
  app.use(express.json({ limit: "16kb" }));

  // State-changing requests must be JSON: a plain HTML form from another site
  // cannot send that, which together with SameSite=Lax blocks CSRF.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && !req.is("application/json")) {
      return void res.status(415).json({ error: "Send JSON." });
    }
    next();
  });

  const setCookie = (res: Response, token: string) =>
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/api",
      maxAge: SESSION_DAYS * 86_400_000,
    });
  const tokenOf = (req: Request) => cookieValue(req.headers.cookie, COOKIE);

  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    const userId = await userOfSession(db, tokenOf(req));
    if (userId === null) return void res.status(401).json({ error: "Log in first." });
    res.locals.userId = userId;
    next();
  };

  app.get("/api/health", async (_req, res) => {
    await db.execute("SELECT 1"); // also checks the database connection
    res.json({ ok: true });
  });

  app.post("/api/auth/register", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email) return void res.status(400).json({ error: "Enter a valid email." });
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
      return void res.status(400).json({ error: `The password needs at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (await one(db, "SELECT 1 FROM users WHERE email = ?", email)) {
      return void res.status(409).json({ error: "This email is already registered." });
    }
    const hash = await hashPassword(password);
    const { lastInsertRowid } = await run(db, "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)", email, hash, Date.now());
    setCookie(res, await startSession(db, Number(lastInsertRowid)));
    res.status(201).json({ email });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    // The email is part of the key: behind a proxy many users may share one address.
    const key = `${req.ip ?? "?"}|${email ?? ""}`;
    if (await isBlocked(db, key)) return void res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = email
      ? await one<{ id: number; password_hash: string }>(db, "SELECT id, password_hash FROM users WHERE email = ?", email)
      : undefined;
    const ok = await checkPassword(password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) {
      await recordFailure(db, key, loginLimit);
      return void res.status(401).json({ error: "Wrong email or password." });
    }
    await clearFailures(db, key);
    setCookie(res, await startSession(db, Number(user.id)));
    res.json({ email });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = tokenOf(req);
    if (token) await endSession(db, token);
    res.clearCookie(COOKIE, { path: "/api" });
    res.json({ ok: true });
  });

  // Signed out is a normal answer here (email null), not an error.
  app.get("/api/me", async (req, res) => {
    const userId = await userOfSession(db, tokenOf(req));
    const user = userId === null ? undefined : await one<{ email: string }>(db, "SELECT email FROM users WHERE id = ?", userId);
    res.json({ email: user?.email ?? null });
  });

  app.get("/api/settings", requireUser, async (_req, res) => {
    const row = await one<{ json: string }>(db, "SELECT json FROM settings WHERE user_id = ?", res.locals.userId);
    // null = nothing saved yet: the client keeps what it has and uploads it.
    res.json({ settings: row ? parseSettings(JSON.parse(row.json)) : null });
  });

  app.put("/api/settings", requireUser, async (req, res) => {
    const settings = parseSettings(req.body?.settings);
    await run(
      db,
      "INSERT INTO settings (user_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
      res.locals.userId,
      JSON.stringify(settings),
      Date.now(),
    );
    res.json({ settings });
  });

  app.post("/api/stats/sessions", requireUser, async (req, res) => {
    const s = parsePracticeSession(req.body);
    if (!s) return void res.status(400).json({ error: "Not a valid practice session." });
    await run(
      db,
      `INSERT INTO practice_sessions (user_id, page, started_at, seconds, notes_heard, notes_in_tune, sum_abs_cents, chords_shown, engine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      res.locals.userId, s.page, s.startedAt, s.seconds, s.notesHeard, s.notesInTune, s.sumAbsCents, s.chordsShown, s.engine,
    );
    res.status(201).json({ ok: true });
  });

  app.get("/api/stats/summary", requireUser, async (req, res) => {
    const days = Math.min(365, Math.max(1, Number.parseInt(String(req.query.days ?? "7"), 10) || 7));
    res.json(await summarize(db, res.locals.userId, days));
  });

  app.use("/api", (_req, res) => void res.status(404).json({ error: "Not found." }));
  // Bad JSON and anything unexpected: a short message, never a stack trace.
  app.use((error: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = error.status && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? "Server error." : "Bad request." });
  });
  return app;
}

export async function summarize(db: Db, userId: number, days: number, now = Date.now()): Promise<PracticeSummary> {
  const dayMs = 86_400_000;
  const firstDay = Math.floor(now / dayMs) - days + 1; // UTC days
  const rows = await all<{
    page: (typeof PRACTICE_PAGES)[number];
    started_at: number;
    seconds: number;
    notes_heard: number;
    notes_in_tune: number;
    sum_abs_cents: number;
    chords_shown: number;
    engine: "dsp" | "ai" | null;
  }>(db, "SELECT * FROM practice_sessions WHERE user_id = ? AND started_at >= ? ORDER BY started_at", userId, firstDay * dayMs);

  const minutes = { tuner: 0, notes: 0, chords: 0 };
  const perDay = Array.from({ length: days }, (_, i) => ({
    day: new Date((firstDay + i) * dayMs).toISOString().slice(0, 10),
    minutes: 0,
  }));
  let notesHeard = 0, notesInTune = 0, sumAbsCents = 0;
  const chordsShown = { dsp: 0, ai: 0 };
  for (const r of rows) {
    const seconds = Number(r.seconds);
    minutes[r.page] += seconds / 60;
    const day = perDay[Math.floor(Number(r.started_at) / dayMs) - firstDay];
    if (day) day.minutes += seconds / 60;
    notesHeard += Number(r.notes_heard);
    notesInTune += Number(r.notes_in_tune);
    sumAbsCents += Number(r.sum_abs_cents);
    if (r.engine) chordsShown[r.engine] += Number(r.chords_shown);
  }
  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    days,
    sessions: rows.length,
    minutes: { tuner: round(minutes.tuner), notes: round(minutes.notes), chords: round(minutes.chords) },
    minutesPerDay: perDay.map((d) => ({ day: d.day, minutes: round(d.minutes) })),
    notesHeard,
    inTuneShare: notesHeard ? notesInTune / notesHeard : null,
    meanAbsCents: notesHeard ? round(sumAbsCents / notesHeard) : null,
    chordsShown,
  };
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
