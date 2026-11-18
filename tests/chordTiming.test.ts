import { test } from "node:test";
import assert from "node:assert/strict";
import { ChordTiming, SETTLED_MS } from "../src/audio/chordTiming.ts";

// One analysis every 100 ms: the level and the chord on the screen.
function play(timing: ChordTiming, steps: [number, string | null][], from = 0) {
  steps.forEach(([dbfs, shown], i) => {
    const now = from + i * 100;
    timing.level(dbfs, dbfs > -50, now);
    timing.show(shown, now);
  });
  return from + steps.length * 100;
}

test("first result and reaction: from the strum to the change on the screen", () => {
  const t = new ChordTiming();
  t.start();
  // Silence, a strum at 200 ms, Am appears at 400 ms and stays.
  let now = play(t, [[-70, null], [-70, null], [-30, null], [-32, null], [-33, "Am"], ...Array(12).fill([-35, "Am"])]);
  // A new strum (level jumps again) at the next step; C appears 300 ms later.
  play(t, [[-50, "Am"], [-28, "Am"], [-29, "Am"], [-30, "Am"], [-31, "C"], ...Array(12).fill([-33, "C"])], now);
  const s = t.summary();
  assert.equal(s.firstResult.median, 200);
  assert.equal(s.reaction.median, 300);
  assert.equal(s.reaction.count, 1);
  assert.equal(s.settle.count, 2);
});

test("settled: the moment the name stopped changing, measured from the strum", () => {
  const t = new ChordTiming();
  t.start();
  // Strum at 0; the screen flips Am → A → Am before it stays Am.
  play(t, [[-70, null], [-30, "Am"], [-31, "A"], [-32, "Am"], ...Array(SETTLED_MS / 100 + 1).fill([-33, "Am"])]);
  assert.equal(t.summary().settle.median, 200, "the last change was 200 ms after the strum");
});

test("the same chord strummed again is not a reaction", () => {
  const t = new ChordTiming();
  t.start();
  const now = play(t, [[-70, null], [-30, "G"], ...Array(12).fill([-34, "G"])]);
  play(t, [[-50, "G"], [-29, "G"], ...Array(12).fill([-33, "G"])], now);
  const s = t.summary();
  assert.equal(s.reaction.count, 0);
  assert.equal(s.settle.count, 1, "only the first strum settled a new name");
});

test("AI load time is kept", () => {
  const t = new ChordTiming();
  t.modelLoaded(4321.4);
  assert.deepEqual(t.summary().modelLoadMs, [4321]);
});
