import { test } from "node:test";
import assert from "node:assert/strict";
import { PracticeTracker } from "../src/stats/practiceTracker.ts";

test("a held note counts once, with the cents where it ended", () => {
  const t = new PracticeTracker("tuner", 0);
  // A2 tuned from −20 c up to +2 c, then held there: one note, in tune.
  for (let ms = 0; ms < 500; ms += 100) t.hearNote("A2", -20 + ms / 25, ms);
  for (let ms = 500; ms <= 1500; ms += 100) t.hearNote("A2", 2, ms);
  t.hearNote(null, 0, 1600);
  // A passing note (200 ms) does not count.
  t.hearNote("B2", 30, 1700);
  t.hearNote(null, 0, 1900);
  const s = t.finish(10_000, null)!;
  assert.equal(s.notesHeard, 1);
  assert.equal(s.notesInTune, 1);
  assert.ok(s.sumAbsCents <= 5);
  assert.equal(s.seconds, 10);
});

test("a note far off is heard but not in tune", () => {
  const t = new PracticeTracker("notes", 0);
  for (let ms = 0; ms <= 600; ms += 100) t.hearNote("E2", 18, ms);
  const s = t.finish(6000, null)!;
  assert.deepEqual([s.notesHeard, s.notesInTune, s.sumAbsCents], [1, 0, 18]);
});

test("chords count when they appear, and the engine is kept", () => {
  const t = new PracticeTracker("chords", 0);
  for (const name of ["Am", "Am", null, "Am", "C", "C", "G"]) t.showChord(name);
  const s = t.finish(20_000, "ai")!;
  assert.equal(s.chordsShown, 4, "Am, Am again after a pause, C, G");
  assert.equal(s.engine, "ai");
});

test("a quick look (under 5 s) is not reported", () => {
  assert.equal(new PracticeTracker("tuner", 0).finish(4000, null), null);
});
