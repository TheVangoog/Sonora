import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp, summarize } from "../server/app.ts";
import { checkPassword, hashPassword, startSession, userOfSession } from "../server/auth.ts";
import { openDb } from "../server/db.ts";
import { DEFAULT_SETTINGS } from "../src/settings/settingsStore.ts";
import { parsePracticeSession } from "../src/stats/practice.ts";

const db = openDb(":memory:");
let server: Server;
let base = "";

before(async () => {
  server = createApp(db, { secureCookie: false, loginLimit: 3 }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

// A tiny client that keeps the session cookie, like a browser.
function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return { status: res.status, body: await res.json(), setCookie: set };
  };
}

test("passwords: scrypt with salt, never stored as text", async () => {
  const a = await hashPassword("guitar123");
  const b = await hashPassword("guitar123");
  assert.notEqual(a, b, "a new salt every time");
  assert.ok(!a.includes("guitar123"));
  assert.ok(await checkPassword("guitar123", a));
  assert.ok(!(await checkPassword("guitar124", a)));
});

test("sessions expire and only their hash is stored", () => {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('x@y.zz', 'h', 0)")
    .run();
  const token = startSession(db, Number(lastInsertRowid), 0);
  assert.equal(db.prepare("SELECT 1 FROM auth_sessions WHERE token_hash = ?").get(token), undefined);
  assert.equal(userOfSession(db, token, 1000), Number(lastInsertRowid));
  assert.equal(userOfSession(db, token, 31 * 86_400_000), null, "expired after 30 days");
});

test("register → me → logout; the cookie is httpOnly and SameSite=Lax", async () => {
  const call = client();
  const reg = await call("POST", "/api/auth/register", { email: " Ivan@Example.com ", password: "guitar123" });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.email, "ivan@example.com");
  assert.match(reg.setCookie!, /HttpOnly/);
  assert.match(reg.setCookie!, /SameSite=Lax/);
  assert.deepEqual((await call("GET", "/api/me")).body, { email: "ivan@example.com" });
  await call("POST", "/api/auth/logout", {});
  assert.deepEqual((await call("GET", "/api/me")).body, { email: null });
});

test("registration refuses bad input and a taken email", async () => {
  const call = client();
  assert.equal((await call("POST", "/api/auth/register", { email: "nope", password: "guitar123" })).status, 400);
  assert.equal((await call("POST", "/api/auth/register", { email: "a@b.cd", password: "short" })).status, 400);
  assert.equal((await call("POST", "/api/auth/register", { email: "a@b.cd", password: "guitar123" })).status, 201);
  assert.equal((await call("POST", "/api/auth/register", { email: "A@B.cd", password: "guitar123" })).status, 409);
});

test("login: right password works, wrong ones are limited", async () => {
  const call = client();
  await call("POST", "/api/auth/register", { email: "login@test.cz", password: "guitar123" });
  const other = client();
  assert.equal((await other("POST", "/api/auth/login", { email: "login@test.cz", password: "guitar123" })).status, 200);
  assert.equal((await other("GET", "/api/me")).status, 200);
  const attacker = client();
  for (let i = 0; i < 3; i++) {
    assert.equal((await attacker("POST", "/api/auth/login", { email: "login@test.cz", password: "wrong!!!" })).status, 401);
  }
  // After 3 failures (the test limit) even the right password must wait.
  assert.equal((await attacker("POST", "/api/auth/login", { email: "login@test.cz", password: "guitar123" })).status, 429);
});

test("non-JSON POSTs are refused (no CSRF through HTML forms)", async () => {
  const res = await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "a=1",
  });
  assert.equal(res.status, 415);
});

test("settings: saved per user and validated with the client's parseSettings", async () => {
  const call = client();
  await call("POST", "/api/auth/register", { email: "set@test.cz", password: "guitar123" });
  assert.deepEqual((await call("GET", "/api/settings")).body, { settings: null });
  const saved = await call("PUT", "/api/settings", {
    settings: { ...DEFAULT_SETTINGS, referenceHz: 432, instrument: "guitar", chordEngine: "rocket" },
  });
  assert.equal(saved.body.settings.referenceHz, 432);
  assert.equal(saved.body.settings.chordEngine, "dsp", "an unknown value falls back to the default");
  assert.equal((await call("GET", "/api/settings")).body.settings.instrument, "guitar");
  assert.equal((await client()("GET", "/api/settings")).status, 401);
});

test("practice sessions: invalid ones are refused, the summary adds them up", async () => {
  const call = client();
  await call("POST", "/api/auth/register", { email: "stats@test.cz", password: "guitar123" });
  const now = Date.now();
  const tuner = { page: "tuner", startedAt: now - 60_000, seconds: 120, notesHeard: 10, notesInTune: 6, sumAbsCents: 40 };
  const chords = { page: "chords", startedAt: now - 30_000, seconds: 60, chordsShown: 7, engine: "ai" };
  assert.equal((await call("POST", "/api/stats/sessions", tuner)).status, 201);
  assert.equal((await call("POST", "/api/stats/sessions", chords)).status, 201);
  assert.equal((await call("POST", "/api/stats/sessions", { ...tuner, notesInTune: 11 })).status, 400);
  assert.equal((await call("POST", "/api/stats/sessions", { ...tuner, page: "admin" })).status, 400);

  const summary = (await call("GET", "/api/stats/summary?days=7")).body;
  assert.equal(summary.sessions, 2);
  assert.deepEqual(summary.minutes, { tuner: 2, notes: 0, chords: 1 });
  assert.equal(summary.minutesPerDay.length, 7);
  assert.equal(summary.minutesPerDay.reduce((s: number, d: { minutes: number }) => s + d.minutes, 0), 3);
  assert.equal(summary.inTuneShare, 0.6);
  assert.equal(summary.meanAbsCents, 4);
  assert.deepEqual(summary.chordsShown, { dsp: 0, ai: 7 });
});

test("parsePracticeSession keeps only plausible values", () => {
  const now = 1_800_000_000_000;
  const ok = { page: "notes", startedAt: now - 1000, seconds: 30, notesHeard: 2, notesInTune: 1, sumAbsCents: 12 };
  assert.ok(parsePracticeSession(ok, now));
  assert.equal(parsePracticeSession({ ...ok, seconds: 0 }, now), null);
  assert.equal(parsePracticeSession({ ...ok, seconds: 7 * 3600 }, now), null);
  assert.equal(parsePracticeSession({ ...ok, startedAt: now + 3_600_000 }, now), null, "not from the future");
  assert.equal(parsePracticeSession({ ...ok, notesHeard: 1.5 }, now), null);
  assert.equal(parsePracticeSession({ ...ok, engine: "gpu" }, now), null);
});

test("summary of a user with no sessions", () => {
  const s = summarize(db, 9999, 3);
  assert.equal(s.sessions, 0);
  assert.equal(s.inTuneShare, null);
  assert.equal(s.minutesPerDay.length, 3);
});
