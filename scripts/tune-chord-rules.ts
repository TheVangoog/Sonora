// Chooses the margins for non-standard chords (ChordRules in src/audio/chords.ts),
// separately for each engine.
//
// Chosen on the extended GuitarSet; only checked on our recordings and the
// original major/minor GuitarSet.
//
// Run: npm run tune:chord-rules   (needs the Basic Pitch cache: run
//      `node scripts/tune-basic-pitch.ts tests/recordings/guitarset-segments-ext` once)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeWav } from "../src/audio/wav.ts";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { ChordDetector, CHORD_FRAME_SIZE, classifyChroma, DEFAULT_RULES } from "../src/audio/chords.ts";
import type { ChordRules } from "../src/audio/chords.ts";
import type { Chroma } from "../src/audio/chroma.ts";
import { findTemplate, sameNotes } from "../src/audio/chordTemplates.ts";
import {
  BASIC_PITCH_RULES,
  DEFAULT_ACTIVATION_FLOOR,
  framesToChroma,
} from "../src/audio/engines/basicPitchEngine.ts";
import { networkOutput, windowStarts } from "./basicPitchCache.ts";

// ---------- Settings ----------
const CHOOSE_ON = "tests/recordings/guitarset-segments-ext";
const CHECK_ON = ["tests/recordings/real", "tests/recordings/guitarset-segments"];
// 1 = practically "never": a non-standard chord is named only if no major/minor fits at all.
const MARGINS = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 1];
const NO_CHORD = "—";

// ---------- Step 1: a chroma for every window (computed or cached once) ----------
type Window = { dbfs: number; chroma: Chroma | null };
type Take = { expected: string; windows: Window[] };

async function dspTakes(folder: string): Promise<Take[]> {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  return files(folder).map((file) => {
    const { samples, sampleRate } = decodeWav(readFileSync(`${folder}/${file}`).buffer as ArrayBuffer);
    const windows = windowStarts(samples.length, CHORD_FRAME_SIZE, sampleRate).map((start) => {
      // The chroma does not depend on the rules, only the decision does.
      const reading = detector.analyze(samples.slice(start, start + CHORD_FRAME_SIZE), sampleRate);
      return { dbfs: reading.dbfs, chroma: reading.chroma };
    });
    return { expected: expectedOf(file), windows };
  });
}

async function basicPitchTakes(folder: string): Promise<Take[]> {
  const takes: Take[] = [];
  for (const file of files(folder)) {
    const windows = (await networkOutput(folder, file)).map(({ dbfs, frames }) => ({
      dbfs,
      chroma: frames ? framesToChroma(frames, DEFAULT_ACTIVATION_FLOOR) : null,
    }));
    takes.push({ expected: expectedOf(file), windows });
    process.stdout.write(`\rnetwork: ${folder} ${takes.length}   `);
  }
  process.stdout.write("\n");
  return takes;
}

function files(folder: string): string[] {
  return readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
}
function expectedOf(file: string): string {
  return expectedChord(labelFromFileName(file)) ?? NO_CHORD;
}

// ---------- Step 2: score one set of rules ----------
type Score = { correct: number; wrong: number; silent: number; falseAlarm: number; total: number };

function score(takes: Take[], rules: Partial<ChordRules>): Score {
  const result: Score = { correct: 0, wrong: 0, silent: 0, falseAlarm: 0, total: takes.length };
  for (const { expected, windows } of takes) {
    const votes = new Map<string, number>();
    for (const { dbfs, chroma } of windows) {
      if (!chroma) continue;
      const reading = classifyChroma(chroma, dbfs, rules);
      if (reading.status !== "detected") continue;
      const name = sameNotes(reading.chord.name, expected) ? expected : reading.chord.name;
      votes.set(name, (votes.get(name) ?? 0) + 1);
    }
    // Majority vote of the windows, like scripts/evaluate.ts.
    const answer = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NO_CHORD;
    if (answer === expected) result.correct++;
    else if (expected === NO_CHORD) result.falseAlarm++;
    else if (answer === NO_CHORD) result.silent++;
    else result.wrong++;
  }
  return result;
}

const cell = (s: Score) =>
  `${s.correct}/${s.total} (${((100 * s.correct) / s.total).toFixed(1)} %) | ${s.wrong} | ${s.silent} | ${s.falseAlarm}`;
const HEADER = ["| rules | correct | wrong chord | silent | false alarm |", "|---|---|---|---|---|"];

// ---------- Step 3: try every pair of margins, per engine ----------
const lines: string[] = [`# Choosing the rules for non-standard chords (${new Date().toISOString().slice(0, 10)})`, ""];
lines.push(
  `Chosen on \`${CHOOSE_ON}\` (most correct files; ties → fewer wrong chords), ` +
    `then checked on ${CHECK_ON.map((f) => `\`${f}\``).join(" and ")}. ` +
    `"basic" = only the 24 major/minor chords (as before). Margin 1 = practically never.`,
  "",
);

const engines = [
  { name: "Algorithm (DSP)", constant: "DEFAULT_RULES in chords.ts", current: DEFAULT_RULES, takes: dspTakes },
  { name: "AI (Basic Pitch)", constant: "BASIC_PITCH_RULES in basicPitchEngine.ts", current: BASIC_PITCH_RULES, takes: basicPitchTakes },
];

for (const engine of engines) {
  const choose = await engine.takes(CHOOSE_ON);
  const grid: { rules: Partial<ChordRules>; result: Score }[] = [];
  for (const fallback of ["always", "ifHeard"] as const) {
    for (const extendedMargin of MARGINS) {
      for (const powerMargin of MARGINS) {
        const rules = { vocabulary: "extended" as const, extendedMargin, powerMargin, fallback };
        grid.push({ rules, result: score(choose, rules) });
      }
    }
  }
  grid.sort((a, b) => b.result.correct - a.result.correct || a.result.wrong - b.result.wrong);
  const best = grid[0].rules;
  const label = (r: Partial<ChordRules>) =>
    r.vocabulary === "basic"
      ? "basic (major/minor only)"
      : `extended ${r.extendedMargin}, power ${r.powerMargin}, fallback ${r.fallback}`;

  lines.push(`## ${engine.name}`, "", `### Choosing on ${CHOOSE_ON} (top 10 of ${grid.length})`, "", ...HEADER);
  for (const { rules, result } of grid.slice(0, 10)) lines.push(`| ${label(rules)} | ${cell(result)} |`);
  lines.push(`| … current (${label(engine.current)}) | ${cell(score(choose, engine.current))} |`);
  lines.push(`| … basic (major/minor only) | ${cell(score(choose, { vocabulary: "basic" }))} |`, "");

  lines.push(`**Chosen: ${label(best)}** → put into \`${engine.constant}\`.`, "");
  // Which chord types does the chosen rule get right?
  const types = [...new Set(choose.map((t) => findTemplate(t.expected)?.quality ?? "?"))];
  lines.push("By chord type (chosen rules vs. basic):", "", "| type | files | correct (chosen) | correct (basic) |", "|---|---|---|---|");
  for (const type of types) {
    const group = choose.filter((t) => (findTemplate(t.expected)?.quality ?? "?") === type);
    const pct = (n: number) => `${n} (${((100 * n) / group.length).toFixed(0)} %)`;
    lines.push(`| ${type} | ${group.length} | ${pct(score(group, best).correct)} | ${pct(score(group, { vocabulary: "basic" }).correct)} |`);
  }
  lines.push("");
  for (const folder of CHECK_ON) {
    const check = await engine.takes(folder);
    lines.push(`### Check on ${folder}`, "", ...HEADER);
    lines.push(`| chosen: ${label(best)} | ${cell(score(check, best))} |`);
    lines.push(`| basic (major/minor only) | ${cell(score(check, { vocabulary: "basic" }))} |`, "");
  }
}

mkdirSync("docs/results", { recursive: true });
const out = `docs/results/tune-chord-rules-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(out, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nSaved to ${out}`);
