import { test } from "node:test";
import assert from "node:assert/strict";
import { ToneDetector } from "../src/audio/pitch.ts";
import { FRAME_SIZE } from "../src/audio/signal.ts";
import { frequencyToNote } from "../src/audio/notes.ts";

function sine(
  frequency: number,
  sampleRate = 48000,
  amplitude = 0.2,
  offset = 0,
) {
  return Float32Array.from(
    { length: FRAME_SIZE },
    (_, i) =>
      offset +
      amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate + 0.7),
  );
}

for (const sampleRate of [44100, 48000, 96000]) {
  test(`real Pitchy detects guitar strings and test tones at ${sampleRate} samples/s`, () => {
    const detector = new ToneDetector(FRAME_SIZE);
    for (const frequency of [
      82.4069, 110, 146.8324, 196, 246.9417, 329.6276, 440, 880, 1000,
    ]) {
      const result = detector.analyze(sine(frequency, sampleRate), sampleRate);
      assert.equal(
        result.status,
        "detected",
        `${frequency} Hz: ${JSON.stringify(result)}`,
      );
      if (result.status !== "detected") continue;
      const centsError = 1200 * Math.log2(result.frequency / frequency);
      assert.ok(
        Math.abs(centsError) < 2,
        `${frequency} Hz: ${centsError} cents error`,
      );
    }
  });
}

test("a signal with harmonics resolves to its fundamental", () => {
  const fundamental = 196;
  const samples = Float32Array.from({ length: FRAME_SIZE }, (_, i) => {
    const phase = (2 * Math.PI * fundamental * i) / 48000;
    return (
      0.15 * Math.sin(phase) +
      0.2 * Math.sin(2 * phase) +
      0.08 * Math.sin(3 * phase)
    );
  });
  const result = new ToneDetector(FRAME_SIZE).analyze(samples, 48000);
  assert.equal(result.status, "detected");
  if (result.status === "detected")
    assert.ok(Math.abs(1200 * Math.log2(result.frequency / fundamental)) < 2);
});

test("silence, sub-threshold audio and constant offset never produce a note", () => {
  const detector = new ToneDetector(FRAME_SIZE);
  for (const input of [
    new Float32Array(FRAME_SIZE),
    sine(440, 48000, 0.0001),
    new Float32Array(FRAME_SIZE).fill(0.5),
  ]) {
    assert.equal(detector.analyze(input, 48000).status, "quiet");
    assert.equal(detector.analyze(input, 48000).frequency, null);
  }
});

test("a DC offset does not hide a usable musical tone", () => {
  const result = new ToneDetector(FRAME_SIZE).analyze(
    sine(440, 48000, 0.2, 0.5),
    48000,
  );
  assert.equal(result.status, "detected");
  if (result.status === "detected")
    assert.ok(Math.abs(result.frequency - 440) < 0.5);
});

test("deterministic broadband noise is rejected", () => {
  let seed = 123456;
  const noise = Float32Array.from({ length: FRAME_SIZE }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.5;
  });
  const result = new ToneDetector(FRAME_SIZE).analyze(noise, 48000);
  assert.equal(result.status, "unclear");
  assert.equal(result.frequency, null);
});

test("out-of-range tones are not displayed as supported notes", () => {
  const detector = new ToneDetector(FRAME_SIZE);
  for (const frequency of [50, 1800]) {
    const result = detector.analyze(sine(frequency), 48000);
    assert.equal(
      result.status,
      "out-of-range",
      `${frequency} Hz: ${JSON.stringify(result)}`,
    );
    assert.equal(result.frequency, null);
  }
});

test("invalid samples, input length and sampleRate are rejected", () => {
  const detector = new ToneDetector(FRAME_SIZE);
  for (const rate of [0, -1, NaN, Infinity])
    assert.equal(detector.analyze(sine(440), rate).status, "unclear");
  for (const value of [NaN, Infinity]) {
    const samples = sine(440);
    samples[5] = value;
    assert.equal(detector.analyze(samples, 48000).status, "unclear");
  }
  assert.equal(detector.analyze(new Float32Array(16), 48000).status, "unclear");
});

test("quiet frames clear a previously detected note", () => {
  const detector = new ToneDetector(FRAME_SIZE);
  assert.equal(detector.analyze(sine(440), 48000).status, "detected");
  assert.equal(
    detector.analyze(new Float32Array(FRAME_SIZE), 48000).frequency,
    null,
  );
});

test("A4, A5, C4 and a sharp have the correct note and octave", () => {
  for (const [frequency, label] of [
    [440, "A4"],
    [880, "A5"],
    [261.625565, "C4"],
    [277.182631, "C♯4"],
  ] as const) {
    const note = frequencyToNote(frequency);
    assert.equal(note?.label, label);
    assert.ok(Math.abs(note!.cents) < 0.01);
  }
});

test("cents show direction and wrap to the next note across a semitone midpoint", () => {
  const flat = frequencyToNote(440 * 2 ** (-25 / 1200));
  const sharp = frequencyToNote(440 * 2 ** (25 / 1200));
  assert.equal(flat?.direction, "flat");
  assert.equal(sharp?.direction, "sharp");
  assert.ok(Math.abs(flat!.cents + 25) < 1e-8);
  assert.equal(frequencyToNote(440 * 2 ** (49 / 1200))?.label, "A4");
  const next = frequencyToNote(440 * 2 ** (51 / 1200));
  assert.equal(next?.label, "A♯4");
  assert.ok(Math.abs(next!.cents + 49) < 1e-8);
});

test("changing reference changes the target, not the measured frequency", () => {
  assert.equal(frequencyToNote(440, 440)?.direction, "in-tune");
  const note = frequencyToNote(440, 442);
  assert.equal(note?.label, "A4");
  assert.equal(note?.targetFrequency, 442);
  assert.equal(note?.direction, "flat");
  assert.ok(Math.abs(note!.cents - 1200 * Math.log2(440 / 442)) < 1e-8);
});

test("invalid note conversion inputs return null", () => {
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(frequencyToNote(value), null);
    assert.equal(frequencyToNote(440, value), null);
  }
});
