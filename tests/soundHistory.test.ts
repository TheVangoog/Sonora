import { test } from "node:test";
import assert from "node:assert/strict";
import { SoundHistory } from "../src/audio/soundHistory.ts";

test("sound history keeps the newest samples in time order", () => {
  const history = new SoundHistory(8);
  assert.equal(history.latest(4), null, "nothing heard yet");
  history.push(Float32Array.from([1, 2, 3, 4, 5, 6]));
  history.push(Float32Array.from([7, 8, 9, 10])); // wraps around the end
  assert.deepEqual([...history.latest(4)!], [7, 8, 9, 10]);
  assert.deepEqual([...history.latest(8)!], [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(history.latest(9), null, "never more than it can hold");
});
