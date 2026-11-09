import { test } from "node:test";
import assert from "node:assert/strict";
import { PitchSmoother, HOLD_MS } from "../src/audio/pitchSmoother.ts";
import type { PitchReading } from "../src/audio/pitch.ts";
import {
  GUITAR_STRINGS,
  nearestString,
  targetForString,
} from "../src/audio/guitarStrings.ts";

const hz = (frequency: number): PitchReading => ({
  status: "detected",
  frequency,
  clarity: 0.95,
});
const unclear: PitchReading = { status: "unclear", frequency: null, clarity: 0.4 };
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const shownHz = (reading: PitchReading) =>
  reading.status === "detected" ? reading.frequency : Number.NaN;

// ---------- Smoothing ----------
test("one wrong frame (octave error) does not move the display", () => {
  const smoother = new PitchSmoother();
  let time = 0;
  for (let i = 0; i < 4; i++) smoother.push(hz(246.9), (time += 75));
  const afterOutlier = smoother.push(hz(493.9), (time += 75));
  assert.ok(Math.abs(cents(shownHz(afterOutlier), 246.9)) < 1);
});

test("jitter of ±10 cents is calmed down to a few cents", () => {
  const smoother = new PitchSmoother();
  let time = 0;
  const shown: number[] = [];
  for (let i = 0; i < 30; i++) {
    const noisy = 246.94 * 2 ** ((i % 2 ? 10 : -10) / 1200);
    shown.push(shownHz(smoother.push(hz(noisy), (time += 75))));
  }
  const lastTen = shown.slice(-10).map((f) => cents(f, 246.94));
  assert.ok(Math.max(...lastTen.map(Math.abs)) < 4, lastTen.join(", "));
});

test("the note is held for a moment after the sound becomes unclear", () => {
  const smoother = new PitchSmoother();
  let time = 0;
  for (let i = 0; i < 3; i++) smoother.push(hz(110), (time += 75));
  const held = smoother.push(unclear, time + HOLD_MS / 2);
  assert.equal(held.status, "detected");
  assert.equal(held.status === "detected" && held.held, true);
  const released = smoother.push(unclear, time + HOLD_MS + 1);
  assert.equal(released.status, "unclear");
});

test("a real move to another string is followed quickly", () => {
  const smoother = new PitchSmoother();
  let time = 0;
  for (let i = 0; i < 5; i++) smoother.push(hz(110), (time += 75));
  let last: PitchReading = unclear;
  for (let i = 0; i < 3; i++) last = smoother.push(hz(196), (time += 75));
  assert.ok(Math.abs(cents(shownHz(last), 196)) < 1);
});

// ---------- Guitar strings ----------
test("nearest string: a slightly flat B is the 2nd string", () => {
  const target = nearestString(246.94 * 2 ** (-30 / 1200));
  assert.equal(target.string.number, 2);
  assert.ok(Math.abs(target.cents + 30) < 0.1, String(target.cents));
});

test("chosen string: a B tuned a whole tone down still targets B, −200 cents", () => {
  const b = GUITAR_STRINGS.find((s) => s.number === 2)!;
  const target = targetForString(220, b);
  assert.equal(target.string.number, 2);
  assert.ok(Math.abs(target.cents + 200) < 0.1);
});

test("chosen string: an octave error is folded back to the string", () => {
  const b = GUITAR_STRINGS.find((s) => s.number === 2)!;
  assert.ok(Math.abs(targetForString(493.88, b).cents) < 0.1);
  assert.ok(Math.abs(targetForString(123.47, b).cents) < 0.1);
});
