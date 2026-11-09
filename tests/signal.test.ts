import { test } from "node:test";
import assert from "node:assert/strict";
import { measureSignal } from "../src/audio/signal.ts";

test("silence has zero RMS and negative infinite dBFS, never NaN", () => {
  assert.deepEqual(measureSignal(new Float32Array(2048)), {
    rms: 0,
    peak: 0,
    dbfs: -Infinity,
  });
  assert.equal(measureSignal(new Float32Array()).rms, 0);
});

test("a sine with peak 0.2 has RMS 0.2/sqrt(2) and about -17 dBFS", () => {
  const sine = Float32Array.from(
    { length: 48000 },
    (_, i) => 0.2 * Math.sin((2 * Math.PI * 440 * i) / 48000),
  );
  const level = measureSignal(sine);
  assert.ok(Math.abs(level.rms - 0.2 / Math.SQRT2) < 1e-7);
  assert.ok(Math.abs(level.dbfs - -16.9897) < 0.001);
});

test("doubling amplitude increases dBFS by about 6.02, independently of pitch", () => {
  const sine = (frequency: number, amplitude: number) =>
    Float32Array.from(
      { length: 48000 },
      (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / 48000),
    );
  const low = measureSignal(sine(220, 0.2));
  const high = measureSignal(sine(880, 0.4));
  assert.ok(Math.abs(high.dbfs - low.dbfs - 6.0206) < 0.001);
});

test("signed samples do not cancel RMS; out-of-range peaks stay visible", () => {
  const level = measureSignal(new Float32Array([-1.2, 1.2]));
  assert.ok(level.rms > 1 && level.peak > 1 && level.dbfs > 0);
});
