// Replays recordings through the LIVE chord page logic (algorithm mode):
// every 100 ms the last 8192 samples go to the detector, then to the same
// LiveChordTracker the page uses (level gate, stabilizers, last-chord hold).
//
// It answers "does the chord flicker / vanish while I am playing?" with numbers:
//   visible    share of playing time with a chord on screen,
//   dropouts   how often per minute the chord vanishes while a chord is played,
//   correct    share of playing time with the RIGHT chord on screen.
//
// Material: full GuitarSet accompaniment tracks (continuous playing, every 3rd
// track) and your own takes in tests/recordings/real (one strum, then it fades).
//
// Run: npm run replay:live
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeWav } from "../src/audio/wav.ts";
import { ChordDetector, CHORD_FRAME_SIZE } from "../src/audio/chords.ts";
import type { ChordReading, ChordRules } from "../src/audio/chords.ts";
import { sameNotes } from "../src/audio/chordTemplates.ts";
import { DSP_LIVE, LiveChordTracker } from "../src/audio/liveChordTracker.ts";
import type { LiveSettings } from "../src/audio/liveChordTracker.ts";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { harteToChord, harteToTriad } from "./guitarsetLabels.ts";

const STEP_MS = 100;
const RAW_DIR = "tests/recordings/guitarset";
const EVERY_NTH_TRACK = 3;

// The variants we compare. "before" = the page as it was (one threshold, no hold).
const VARIANTS: { name: string; settings: LiveSettings }[] = [
  { name: "before (gate +12 dB only, no hold)", settings: { ...DSP_LIVE, closeMarginDb: 12, holdMs: 0 } },
  { name: "gate +12 / +6 dB", settings: { ...DSP_LIVE, closeMarginDb: 6, holdMs: 0 } },
  { name: "gate +12 / +3 dB", settings: { ...DSP_LIVE, closeMarginDb: 3, holdMs: 0 } },
  { name: "gate +12 / +6 dB + hold 4 s", settings: { ...DSP_LIVE, closeMarginDb: 6, holdMs: 4000 } },
];

// ---------- One recording → one reading every 100 ms (independent of the variant) ----------
type Step = { reading: ChordReading; expected: string | null };

function readings(samples: Float32Array, sampleRate: number, rules: Partial<ChordRules>,
  expectedAt: (seconds: number) => string | null): Step[] {
  const detector = new ChordDetector(CHORD_FRAME_SIZE, rules);
  const steps: Step[] = [];
  for (let end = CHORD_FRAME_SIZE; end <= samples.length; end += Math.round((STEP_MS / 1000) * sampleRate)) {
    const reading = detector.analyze(samples.slice(end - CHORD_FRAME_SIZE, end), sampleRate);
    steps.push({ reading, expected: expectedAt(end / sampleRate) });
  }
  return steps;
}

// ---------- Run one variant over the steps and count ----------
type Count = { playing: number; visible: number; correct: number; dropouts: number };

function replay(steps: Step[], settings: LiveSettings, count: Count) {
  const tracker = new LiveChordTracker(settings);
  let wasVisible = false;
  steps.forEach(({ reading, expected }, i) => {
    const view = tracker.update(reading, tracker.hear(reading.dbfs), i * STEP_MS);
    const shown = view.shownChord ?? view.likelyChord ?? view.heldChord;
    if (expected) {
      count.playing++;
      if (shown) count.visible++;
      if (shown && sameNotes(shown.name, expected)) count.correct++;
      if (wasVisible && !shown) count.dropouts++;
    }
    wasVisible = shown !== null;
  });
}

// ---------- Material ----------
type Jams = { annotations: { namespace: string; data: { time: number; duration: number; value: string }[] }[] };

function guitarSetTracks(vocabulary: ChordRules["vocabulary"]): Step[][] {
  const toChord = vocabulary === "basic" ? harteToTriad : harteToChord;
  const titles = readdirSync(`${RAW_DIR}/annotation`).filter((f) => f.endsWith("_comp.jams")).sort()
    .filter((_, i) => i % EVERY_NTH_TRACK === 0);
  return titles.map((file, n) => {
    const title = file.replace(".jams", "");
    const jams: Jams = JSON.parse(readFileSync(`${RAW_DIR}/annotation/${file}`, "utf8"));
    const played = jams.annotations.filter((a) => a.namespace === "chord")[1];
    const { samples, sampleRate } = decodeWav(readFileSync(`${RAW_DIR}/audio/${title}_mic.wav`).buffer as ArrayBuffer);
    process.stdout.write(`\r${vocabulary}: track ${n + 1}/${titles.length}   `);
    // Only moments with a chord Sonora knows count; the first 0.3 s of each chord
    // is the attack and the frame still holds the previous chord, so it is skipped.
    return readings(samples, sampleRate, { vocabulary }, (t) => {
      const segment = played.data.find((s) => t >= s.time + 0.3 && t < s.time + s.duration);
      return segment ? toChord(segment.value) : null;
    });
  });
}

function ownTakes(vocabulary: ChordRules["vocabulary"]): Step[][] {
  const folder = "tests/recordings/real";
  return readdirSync(folder).filter((f) => f.endsWith(".wav") && !f.startsWith("none-")).map((file) => {
    const { samples, sampleRate } = decodeWav(readFileSync(`${folder}/${file}`).buffer as ArrayBuffer);
    const chord = expectedChord(labelFromFileName(file));
    // The strum starts somewhere in the take: count from the loudest moment on.
    const steps = readings(samples, sampleRate, { vocabulary }, () => chord);
    const loudest = steps.reduce((best, s, i) => (s.reading.dbfs > steps[best].reading.dbfs ? i : best), 0);
    return steps.map((s, i) => ({ ...s, expected: i >= loudest ? s.expected : null }));
  });
}

// ---------- Report ----------
const lines = [`# Live replay: does the chord stay on screen? (${new Date().toISOString().slice(0, 10)})`, ""];
lines.push(
  "Algorithm mode, one reading every 100 ms, exactly the page logic (`LiveChordTracker`). " +
    "**visible** = share of playing time with a chord on screen; **dropouts** = times per minute " +
    "the chord vanishes while one is played; **correct** = share of playing time with the right chord.",
  "",
);
for (const vocabulary of ["basic", "extended"] as const) {
  for (const [label, tracks] of [
    [`GuitarSet, every ${EVERY_NTH_TRACK}rd full accompaniment track`, guitarSetTracks(vocabulary)],
    ["your takes (from the strum to the end)", ownTakes(vocabulary)],
  ] as const) {
    lines.push(`## ${label}, ${vocabulary === "basic" ? "major/minor only" : "all chords"}`, "");
    lines.push("| variant | visible | dropouts / min | correct |", "|---|---|---|---|");
    for (const { name, settings } of VARIANTS) {
      const count: Count = { playing: 0, visible: 0, correct: 0, dropouts: 0 };
      for (const steps of tracks) replay(steps, settings, count);
      const minutes = (count.playing * STEP_MS) / 60000;
      const pct = (n: number) => `${((100 * n) / count.playing).toFixed(1)} %`;
      lines.push(`| ${name} | ${pct(count.visible)} | ${(count.dropouts / minutes).toFixed(1)} | ${pct(count.correct)} |`);
    }
    lines.push("");
  }
}
process.stdout.write("\n");
mkdirSync("docs/results", { recursive: true });
const out = `docs/results/replay-live-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(out, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nSaved to ${out}`);
