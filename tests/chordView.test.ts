import { test } from "node:test";
import assert from "node:assert/strict";
import { ChordDetector, CHORD_FRAME_SIZE } from "../src/audio/chords.ts";
import { chordViewOf } from "../src/audio/chordView.ts";
import type { ChordView } from "../src/audio/chordView.ts";
import { DSP_LIVE, LiveChordTracker } from "../src/audio/liveChordTracker.ts";
import { ToneDetector, tunerFrameSize } from "../src/audio/pitch.ts";
import { analyzeSafely } from "../src/audio/engines/chordEngine.ts";
import type { ChordEngine } from "../src/audio/engines/chordEngine.ts";
import { DEMO_CHORD_VOICINGS, midiToFrequency } from "../src/audio/demoChords.ts";

const RATE = 48000;
const STEP = Math.round(0.1 * RATE); // the page analyses every 100 ms

// The whole page path: detector → YIN → tracker (gate + stabilizers) → what is shown.
function showOnPage(sound: (i: number) => number, steps = 15): ChordView[] {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  const yin = new ToneDetector();
  const tracker = new LiveChordTracker(DSP_LIVE);
  const views: ChordView[] = [];
  for (let k = 0; k < steps; k++) {
    const frame = Float32Array.from({ length: CHORD_FRAME_SIZE }, (_, i) => sound(i + k * STEP));
    const reading = detector.analyze(frame, RATE);
    const tone = yin.analyze(frame.subarray(frame.length - tunerFrameSize(RATE)), RATE);
    views.push(chordViewOf(tracker.update(reading, tracker.hear(reading.dbfs), k * 100, tone)));
  }
  return views;
}

const sine = (hz: number, level = 0.2) => (i: number) => level * Math.sin((2 * Math.PI * hz * i) / RATE);

// A string with 10 harmonics fading as 1/h^1.2 (like the strum() in chords.test.ts).
const strings = (midis: number[], level = 0.3) => (i: number) => {
  let sum = 0;
  midis.forEach((midi, s) => {
    const f = midiToFrequency(midi);
    for (let h = 1; h <= 10 && f * h < RATE / 2.2; h++) {
      sum += (level / midis.length / h ** 1.2) * Math.sin((2 * Math.PI * f * h * i) / RATE + ((s * 7 + h * 3) % 6));
    }
  });
  return sum;
};

// Supervisor's case (16. 11. 2026): the detector called 110 Hz unclear, but the
// page showed "probably Amaj7".
test("a pure 110 Hz tone is shown as one note A2, never as a chord", () => {
  const views = showOnPage(sine(110));
  assert.ok(views.every((v) => v.kind === "note" || v.kind === "none"), views.map((v) => v.kind).join(","));
  const last = views.at(-1)!;
  assert.equal(last.kind, "note");
  assert.equal(last.title, "A2");
});

test("one plucked string (with harmonics) is one note, not a power chord", () => {
  const last = showOnPage(strings([45])).at(-1)!; // A2
  assert.equal(last.kind, "note");
  assert.equal(last.title, "A2");
});

test("a strummed chord is still a chord", () => {
  const am = showOnPage(strings(DEMO_CHORD_VOICINGS.Am as number[])).at(-1)!;
  assert.equal(am.kind, "chord");
  assert.equal(am.chord?.name, "Am");
  const g = showOnPage(strings(DEMO_CHORD_VOICINGS.G as number[])).at(-1)!;
  assert.equal(g.kind, "chord");
  assert.equal(g.chord?.name, "G");
});

test("a chord fading into one ringing string stays that chord, not a note", () => {
  const am = strings(DEMO_CHORD_VOICINGS.Am as number[]);
  const lastString = strings([45], 0.1);
  const views = showOnPage((i) => (i < 10 * STEP ? am(i) : lastString(i)), 20);
  assert.equal(views[9].chord?.name, "Am");
  assert.ok(views.slice(10).every((v) => v.kind !== "note"), views.map((v) => v.kind).join(","));
  assert.equal(views.at(-1)!.chord?.name, "Am");
});

test("silence is no chord", () => {
  const views = showOnPage(() => 0);
  assert.equal(views.at(-1)!.kind, "none");
  assert.equal(views.at(-1)!.title, "—");
});

test("an AI analysis that throws becomes a value the page can fall back on", async () => {
  const broken: ChordEngine = {
    id: "broken",
    label: "broken",
    windowSamples: () => 4,
    analyze: async () => {
      throw new Error("WebGL context lost");
    },
  };
  const result = await analyzeSafely(broken, new Float32Array(4), RATE);
  assert.equal(result.ok, false);
  assert.match(String(!result.ok && (result.error as Error).message), /WebGL/);
});
