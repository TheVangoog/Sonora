import { test } from "node:test";
import assert from "node:assert/strict";
import { FRAME_WORKLET, FrameRing } from "../src/audio/frameRing.ts";
import { LatencyStats, percentile } from "../src/audio/latency.ts";
import { ToneDetector, tunerFrameSize } from "../src/audio/pitch.ts";

const RATE = 48000;
const BLOCK = 128; // one AudioWorklet render quantum

test("the worklet ring sends a frame every hop once it is full", () => {
  const ring = new FrameRing(8, 4);
  const sent: number[][] = [];
  let t = 0;
  for (let b = 0; b < 6; b++) {
    const block = Float32Array.from({ length: 2 }, () => t++);
    if (ring.push(block)) {
      const out = new Float32Array(8);
      ring.copyLatest(out);
      sent.push([...out]);
    }
  }
  // 12 samples heard: full at 8, then every 4.
  assert.deepEqual(sent, [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [4, 5, 6, 7, 8, 9, 10, 11],
  ]);
});

// The comparison is fair only if both paths give YIN the same frame:
// the worklet frame must equal the AnalyserNode frame (the newest N samples).
test("a worklet frame is the same as the newest samples, so YIN gives the same result", () => {
  const size = tunerFrameSize(RATE);
  const hop = Math.round(0.075 * RATE);
  const signal = Float32Array.from({ length: RATE }, (_, i) => 0.2 * Math.sin((2 * Math.PI * 110 * i) / RATE));
  const ring = new FrameRing(size, hop);
  const frame = new Float32Array(size);
  let end = 0;
  for (let at = 0; at + BLOCK <= signal.length; at += BLOCK) {
    if (ring.push(signal.subarray(at, at + BLOCK))) {
      ring.copyLatest(frame);
      end = at + BLOCK;
    }
  }
  const newest = signal.subarray(end - size, end);
  assert.deepEqual([...frame], [...newest]);
  const yin = new ToneDetector();
  const a = yin.analyze(frame, RATE);
  const b = yin.analyze(newest, RATE);
  assert.equal(a.frequency, b.frequency);
});

test("the worklet source embeds the tested ring and is plain JavaScript", () => {
  assert.match(FRAME_WORKLET, /const FrameRing = class FrameRing/);
  assert.doesNotMatch(FRAME_WORKLET, /: Float32Array|: number/, "no TypeScript left in the worklet");
  // It must at least parse (AudioWorklet globals are only referenced inside methods).
  assert.doesNotThrow(() => new Function("AudioWorkletProcessor", "registerProcessor", FRAME_WORKLET));
});

test("latency statistics: median, p95 and the real interval between frames", () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95), 95);
  assert.ok(Number.isNaN(percentile([], 50)));

  const stats = new LatencyStats();
  for (let i = 0; i < 20; i++) {
    stats.arrived(i * 80);
    stats.record({ waitMs: 2, analyzeMs: 1, displayMs: i === 19 ? 100 : 10 });
  }
  const summary = stats.summary();
  assert.equal(summary.count, 20);
  assert.equal(summary.interval.median, 80);
  assert.equal(summary.total.median, 12);
  assert.equal(summary.total.p95, 12, "one slow frame out of 20 is above the 95th percentile");
  stats.reset();
  assert.equal(stats.summary().count, 0);
});
