// Finds a good ACTIVATION FLOOR for Basic Pitch ("how sure must the network be
// before we say a note is playing").
//
// The network output is cached (basicPitchCache.ts), so trying floors is fast.
//
// Run: npm run tune:basic-pitch                 (GuitarSet + your recordings)
//      node scripts/tune-basic-pitch.ts <folder> [<folder> …]
//
// The floor is chosen on GuitarSet and only checked on our own recordings.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { classifyChroma } from "../src/audio/chords.ts";
import {
  BASIC_PITCH_RULES,
  DEFAULT_ACTIVATION_FLOOR,
  framesToChroma,
} from "../src/audio/engines/basicPitchEngine.ts";
import { networkOutput } from "./basicPitchCache.ts";
import type { CachedWindow } from "./basicPitchCache.ts";

// ---------- Settings ----------
const folders = process.argv.length > 2
  ? process.argv.slice(2)
  : ["tests/recordings/guitarset-segments", "tests/recordings/real"];
// Denser around the best value (0.06 … 0.09), coarser elsewhere.
const FLOORS = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.075, 0.08, 0.09, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
const NO_CHORD = "—";

// Step 1, the network output for every window, lives in basicPitchCache.ts.

// ---------- Step 2: what the engine would answer with a given floor ----------
function answerFor(windows: CachedWindow[], floor: number): string {
  const votes = new Map<string, number>();
  for (const { dbfs, frames } of windows) {
    if (!frames) continue;
    const reading = classifyChroma(framesToChroma(frames, floor), dbfs, BASIC_PITCH_RULES);
    if (reading.status === "detected") votes.set(reading.chord.name, (votes.get(reading.chord.name) ?? 0) + 1);
  }
  // Majority vote of the windows, like scripts/evaluate.ts.
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NO_CHORD;
}

// ---------- Step 3: count the four kinds of outcome for each floor ----------
const lines: string[] = [`# Basic Pitch: choosing the activation floor (${new Date().toISOString().slice(0, 10)})`, ""];
lines.push(
  "Kinds of outcome: **correct**; **silent** = a chord was played but the engine said nothing; " +
    "**wrong chord** = it named a different chord; **false alarm** = nothing was played (none-*) but it named a chord.",
  "",
);

for (const folder of folders) {
  const files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
  const outputs: { expected: string; windows: CachedWindow[] }[] = [];
  for (const file of files) {
    outputs.push({ expected: expectedChord(labelFromFileName(file)) ?? NO_CHORD, windows: await networkOutput(folder, file) });
    process.stdout.write(`\rnetwork: ${folder} ${outputs.length}/${files.length}   `);
  }
  process.stdout.write("\n");

  lines.push(`## ${folder} (${files.length} files)`, "");
  lines.push("| floor | correct | silent | wrong chord | false alarm |", "|---|---|---|---|---|");
  for (const floor of FLOORS) {
    let correct = 0, silent = 0, wrong = 0, falseAlarm = 0;
    for (const { expected, windows } of outputs) {
      const answer = answerFor(windows, floor);
      if (answer === expected) correct++;
      else if (expected === NO_CHORD) falseAlarm++;
      else if (answer === NO_CHORD) silent++;
      else wrong++;
    }
    const percent = ((100 * correct) / files.length).toFixed(1);
    const mark = floor === DEFAULT_ACTIVATION_FLOOR ? " (current)" : "";
    lines.push(`| ${floor}${mark} | ${correct} (${percent} %) | ${silent} | ${wrong} | ${falseAlarm} |`);
  }
  lines.push("");
}

mkdirSync("docs/results", { recursive: true });
const out = `docs/results/tune-basic-pitch-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(out, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nSaved to ${out}`);
