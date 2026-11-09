import { test } from "node:test";
import assert from "node:assert/strict";
import { ChordDetector, CHORD_FRAME_SIZE } from "../src/audio/chords.ts";
import type { ChordReading } from "../src/audio/chords.ts";
import { ChordStabilizer } from "../src/audio/chordStabilizer.ts";
import { CHORD_TEMPLATES, findTemplate } from "../src/audio/chordTemplates.ts";
import { pitchClassOf } from "../src/audio/chroma.ts";
import { framesToChroma } from "../src/audio/engines/basicPitchEngine.ts";
import {
  DEMO_CHORD_VOICINGS,
  midiToFrequency,
} from "../src/audio/demoChords.ts";

// A synthetic “guitar”: each string has 10 harmonics fading as 1/h^1.2
// and different phases. Crude, but closer to a real string than a pure sine.
function strum(midis: number[], sampleRate = 48000, level = 0.3, noise = 0) {
  const samples = new Float32Array(CHORD_FRAME_SIZE);
  midis.forEach((midi, string) => {
    const f = midiToFrequency(midi);
    for (let h = 1; h <= 10 && f * h < sampleRate / 2.2; h++) {
      const amplitude = level / midis.length / h ** 1.2;
      const phase = (string * 7 + h * 3) % 6;
      for (let i = 0; i < samples.length; i++) {
        samples[i] += amplitude * Math.sin((2 * Math.PI * f * h * i) / sampleRate + phase);
      }
    }
  });
  // Deterministic “noise” so the test always gives the same result.
  let seed = 1;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 16807) % 2147483647;
    samples[i] += noise * ((seed / 2147483647) * 2 - 1);
  }
  return samples;
}

test("there are 108 templates and Am consists of A, C and E", () => {
  assert.equal(CHORD_TEMPLATES.length, 12 * 9);
  assert.deepEqual(findTemplate("G7")?.tones, [7, 11, 2, 5]);
  assert.deepEqual(findTemplate("Bm7♭5")?.tones, [11, 2, 5, 9]);
  assert.deepEqual(findTemplate("E5")?.tones, [4, 11]);
  assert.equal(findTemplate("Cmaj7")?.fullName, "C major seventh");
  assert.deepEqual(findTemplate("Am")?.tones, [9, 0, 4]);
  assert.deepEqual(findTemplate("C")?.tones, [0, 4, 7]);
  assert.equal(findTemplate("F♯m")?.fullName, "F♯ minor");
});

test("pitch classes fold octaves together", () => {
  assert.equal(pitchClassOf(110), 9); // A2
  assert.equal(pitchClassOf(220), 9); // A3
  assert.equal(pitchClassOf(261.63), 0); // C4
});

for (const sampleRate of [44100, 48000]) {
  test(`all open guitar chords are recognized at ${sampleRate} samples/s`, () => {
    const detector = new ChordDetector(CHORD_FRAME_SIZE);
    let exactNonStandard = 0;
    for (const [name, midis] of Object.entries(DEMO_CHORD_VOICINGS)) {
      const reading = detector.analyze(strum(midis, sampleRate), sampleRate);
      const played = findTemplate(name)!;
      if (played.quality === "major" || played.quality === "minor") {
        assert.equal(reading.status, "detected", `${name}: ${reading.status}`);
        assert.equal(reading.chord?.name, name);
      } else if (reading.status === "detected") {
        // The FFT needs a clear lead for non-standard chords (margins tuned on
        // GuitarSet), so a close one may get the simpler name (G7 → G) or stay
        // unclear (C7 without its fifth). But never a note that was not played.
        for (const tone of reading.chord.tones) {
          assert.ok(played.tones.includes(tone), `${name} → ${reading.chord.name}`);
        }
        if (reading.chord.name === name) exactNonStandard++;
      }
    }
    assert.ok(exactNonStandard >= 7, `only ${exactNonStandard} of 15 non-standard chords named exactly`);
  });
}

test("a chord is still recognized with some background noise", () => {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  const reading = detector.analyze(strum(DEMO_CHORD_VOICINGS.Am, 48000, 0.3, 0.1), 48000);
  assert.equal(reading.chord?.name, "Am");
});

test("a single string is not reported as a chord", () => {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  for (const midi of [40, 45, 50, 55, 59, 64]) {
    const reading = detector.analyze(strum([midi]), 48000);
    assert.equal(reading.status, "unclear", `MIDI ${midi}: ${reading.chord?.name}`);
  }
});

test("silence is quiet and invalid input is unclear", () => {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  assert.equal(detector.analyze(new Float32Array(CHORD_FRAME_SIZE), 48000).status, "quiet");
  assert.equal(detector.analyze(new Float32Array(1024), 48000).status, "unclear");
  const broken = strum(DEMO_CHORD_VOICINGS.C);
  broken[10] = Number.NaN;
  assert.equal(detector.analyze(broken, 48000).status, "unclear");
});

test("the detector does not modify the caller's samples", () => {
  const samples = strum(DEMO_CHORD_VOICINGS.G).map((x) => x + 0.1);
  const copy = Float32Array.from(samples);
  new ChordDetector(CHORD_FRAME_SIZE).analyze(samples, 48000);
  assert.deepEqual(samples, copy);
});

// ---------- Stabilizer ----------
const detected = (name: string): ChordReading => ({
  dbfs: -30,
  status: "detected",
  chord: findTemplate(name)!,
  confidence: 0.9,
  chroma: new Array(12).fill(0),
  candidates: [],
});
const nothing: ChordReading = {
  dbfs: -40,
  status: "unclear",
  chord: null,
  confidence: 0,
  chroma: null,
  candidates: [],
};

test("stabilizer shows a chord only after it repeats 3 frames in a row", () => {
  const stabilizer = new ChordStabilizer(3, 5);
  assert.equal(stabilizer.push(detected("Am")), null);
  assert.equal(stabilizer.push(detected("Am")), null);
  assert.equal(stabilizer.push(detected("Am"))?.name, "Am");
});

test("stabilizer ignores a one-frame flicker", () => {
  const stabilizer = new ChordStabilizer(3, 5);
  for (let i = 0; i < 3; i++) stabilizer.push(detected("Am"));
  assert.equal(stabilizer.push(detected("C"))?.name, "Am");
  assert.equal(stabilizer.push(detected("Am"))?.name, "Am");
  // A real change still comes through after 3 frames.
  stabilizer.push(detected("C"));
  stabilizer.push(detected("C"));
  assert.equal(stabilizer.push(detected("C"))?.name, "C");
});

test("stabilizer clears the chord after 5 frames without one", () => {
  const stabilizer = new ChordStabilizer(3, 5);
  for (let i = 0; i < 3; i++) stabilizer.push(detected("G"));
  for (let i = 0; i < 4; i++) assert.equal(stabilizer.push(nothing)?.name, "G");
  assert.equal(stabilizer.push(nothing), null);
});

// ---------- Quiet playing in a noisy room ----------
// Room noise: “pink” noise (fan, hum) + 50 Hz mains with harmonics.
function roomNoise(level = 0.01, hum = 0.004) {
  let seed = 3;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const noise = new Float32Array(CHORD_FRAME_SIZE);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < noise.length; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099;
    b1 = 0.963 * b1 + white * 0.2965;
    b2 = 0.57 * b2 + white * 1.0527;
    noise[i] = (level * (b0 + b1 + b2 + white * 0.1848)) / 3;
    for (let h = 1; h <= 6; h++) noise[i] += (hum / h) * Math.sin((2 * Math.PI * 50 * h * i) / 48000 + h);
  }
  return noise;
}

test("quiet chords in a noisy room are still recognized", () => {
  // level 0.05 ≈ −36 dBFS; the room noise alone is ≈ −44 dBFS.
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  const noise = roomNoise();
  let correct = 0;
  for (const [name, midis] of Object.entries(DEMO_CHORD_VOICINGS)) {
    const samples = strum(midis, 48000, 0.05).map((x, i) => x + noise[i]);
    const reading = detector.analyze(samples, 48000);
    const played = findTemplate(name)!;
    if (played.quality === "major" || played.quality === "minor") {
      // The 9 basic open chords: a detected chord must be exactly right.
      if (reading.status === "detected") assert.equal(reading.chord.name, name);
      if (reading.chord?.name === name) correct++;
    } else if (reading.status === "detected") {
      // Non-standard chords: in noise a simpler name is allowed (Cmaj7 → Em),
      // but never a chord with notes that were not played.
      for (const tone of reading.chord.tones) {
        assert.ok(played.tones.includes(tone), `${name} → ${reading.chord.name}`);
      }
    }
  }
  assert.ok(correct >= 8, `only ${correct} of 9 basic chords`);
});

test("room noise alone is not reported as a chord", () => {
  const reading = new ChordDetector(CHORD_FRAME_SIZE).analyze(roomNoise(0.02), 48000);
  assert.notEqual(reading.status, "detected", reading.chord?.name);
});

test("stabilizer keeps a fading chord while it is still the best guess", () => {
  const stabilizer = new ChordStabilizer(2, 5);
  stabilizer.push(detected("Am"));
  stabilizer.push(detected("Am"));
  const fading: ChordReading = {
    ...nothing,
    candidates: [{ template: findTemplate("Am")!, score: 0.65 }],
  };
  for (let i = 0; i < 10; i++) assert.equal(stabilizer.push(fading)?.name, "Am");
});

test("best guess: an unclear reading still names the most likely chord", async () => {
  const { asBestGuess } = await import("../src/audio/chords.ts");
  const unsure: ChordReading = {
    status: "unclear",
    chord: null,
    confidence: 0.62,
    chroma: new Array(12).fill(0.5),
    candidates: [{ template: findTemplate("Em")!, score: 0.62 }],
    dbfs: -35,
  };
  const guess = asBestGuess(unsure);
  assert.equal(guess.status, "detected");
  assert.equal(guess.chord?.name, "Em");
  // Silence stays silence: there is nothing to guess from.
  assert.equal(asBestGuess({ ...nothing, status: "quiet" }).status, "quiet");
});

// ---------- A silence gate that learns the room ----------
test("level gate learns the room and ignores its background", async () => {
  const { LevelGate, MARGIN_DB } = await import("../src/audio/levelGate.ts");
  const gate = new LevelGate();
  // A second of room noise around −48 dBFS: the gate is still learning, so it lets it through.
  for (let i = 0; i < 10; i++) gate.isAboveRoom(-48 + (i % 2));
  assert.equal(gate.isLearning(), false);
  assert.equal(gate.roomLevel(), -48);
  // The hum stays rejected; a strum clearly above the room passes.
  assert.equal(gate.isAboveRoom(-46), false);
  assert.equal(gate.isAboveRoom(-48 + MARGIN_DB + 1), true);
});

test("level gate stays open for continuous playing without pauses", async () => {
  const { LevelGate } = await import("../src/audio/levelGate.ts");
  const gate = new LevelGate();
  // 10 s of steady strumming at −25 dBFS and no silence at all.
  let open = 0;
  for (let i = 0; i < 100; i++) if (gate.isAboveRoom(-25 + (i % 3))) open++;
  assert.equal(open, 100);
});

// Basic Pitch: how the activation floor turns the network's output into chroma.
// Row index = MIDI − 21, so A3 (MIDI 57) is row 36, C4 = 39, E4 = 43.
test("Basic Pitch floor: notes above it count, notes below it are ignored", () => {
  const frame = new Array<number>(88).fill(0);
  frame[36] = 0.6; // A3: the network is quite sure
  frame[39] = 0.5; // C4
  frame[43] = 0.2; // E4: only a little sure
  const strict = framesToChroma([frame], 0.25);
  assert.equal(strict[4], 0, "E is below the 0.25 floor, so it does not count");
  assert.equal(strict[9], 1, "A is the strongest pitch class");
  const relaxed = framesToChroma([frame], 0.1);
  assert.ok(relaxed[4] > 0, "with a lower floor E counts too");
});

// ---------- Non-standard chords ----------
// Chroma order: C C♯ D D♯ E F F♯ G G♯ A A♯ B
test("a non-standard chord must clearly beat the best major/minor chord", async () => {
  const { classifyChroma } = await import("../src/audio/chords.ts");
  const gWithWeakFSharp = [0, 0, 1, 0, 0, 0, 0.5, 1, 0, 0, 0, 1]; // G B D + a little F♯ (a harmonic)
  assert.equal(classifyChroma(gWithWeakFSharp, -30).chord?.name, "G");
  const gMaj7 = [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1]; // G B D F♯, all clear
  assert.equal(classifyChroma(gMaj7, -30).chord?.name, "Gmaj7");
  // With the basic vocabulary only the 24 major/minor chords exist.
  assert.equal(classifyChroma(gMaj7, -30, { vocabulary: "basic" }).chord?.name, "G");
});

test("the fifth may be missing in a seventh chord, but not in a triad", async () => {
  const { classifyChroma } = await import("../src/audio/chords.ts");
  const c7WithoutG = [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]; // C E B♭ (shape x32310)
  assert.equal(classifyChroma(c7WithoutG, -30).chord?.name, "C7");
});

test("chords made of the same notes count as the same chord", async () => {
  const { sameNotes } = await import("../src/audio/chordTemplates.ts");
  assert.ok(sameNotes("Caug", "Eaug"), "C E G♯ = E G♯ C");
  assert.ok(!sameNotes("C", "Am"));
  assert.ok(!sameNotes("Am7", "C6") , "unknown chords are never equal");
});

// ---------- Live page: a fading chord must not flicker ----------
test("level gate has two thresholds: a fading chord stays heard", async () => {
  const { LevelGate } = await import("../src/audio/levelGate.ts");
  const gate = new LevelGate(12, 6);
  for (let i = 0; i < 10; i++) gate.isAboveRoom(-50); // the room: −50 dBFS
  assert.equal(gate.isAboveRoom(-35), true, "strum: −35 ≥ −50 + 12");
  assert.equal(gate.isAboveRoom(-42), true, "fading, still ≥ −50 + 6");
  assert.equal(gate.isAboveRoom(-45), false, "died away: < −50 + 6");
  assert.equal(gate.isAboveRoom(-42), false, "to open again it needs −38");
});

test("live tracker keeps the last chord for a while after the sound stops", async () => {
  const { LiveChordTracker } = await import("../src/audio/liveChordTracker.ts");
  const tracker = new LiveChordTracker({ framesToConfirm: 1, framesToRelease: 1, holdMs: 3000 });
  tracker.update(detected("Am"), true, 0);
  const quiet = tracker.update(nothing, false, 500);
  assert.equal(quiet.shownChord, null);
  assert.equal(quiet.heldChord?.name, "Am", "still shown, faded");
  assert.equal(tracker.update(nothing, false, 4000).heldChord, null, "gone after the hold");
});
