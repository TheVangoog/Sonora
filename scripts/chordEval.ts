// Shared parts of the chord evaluation: the dev/test split of GuitarSet, the
// frozen configuration, cutting takes into windows and the metrics.
// Used by scripts/tune-on-dev.ts (dev only) and scripts/evaluate-test.ts.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { decodeWav } from "../src/audio/wav.ts";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { ChordDetector, CHORD_FRAME_SIZE, classifyChroma, DEFAULT_RULES, MIN_CHORD_DBFS } from "../src/audio/chords.ts";
import type { ChordRules } from "../src/audio/chords.ts";
import type { Chroma } from "../src/audio/chroma.ts";
import { findTemplate, sameNotes } from "../src/audio/chordTemplates.ts";
import {
  BASIC_PITCH_RULES,
  DEFAULT_ACTIVATION_FLOOR,
  framesToChroma,
} from "../src/audio/engines/basicPitchEngine.ts";
import { networkOutput, windowStarts } from "./basicPitchCache.ts";

export const CONFIG_PATH = "scripts/chord-eval.config.json";
export const NO_CHORD = "—";

export type EngineId = "dsp" | "ai";
export type TunedRules = Pick<ChordRules, "extendedMargin" | "powerMargin" | "fallback">;
export type EvalConfig = {
  split: { by: string; dev: string[]; test: string[] };
  selection: string;
  tunedOn: string;
  dsp: TunedRules;
  ai: TunedRules & { activationFloor: number };
  fixed: { minScore: number; minToneLevel: number; minChordDbfs: number; note: string };
};

export function readConfig(): EvalConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

// ---------- The split: by player, so no player is in both parts ----------

/** "D♯__00_BN1-129-Eb_comp_02.wav" or "00_BN1-129-Eb_comp" → "00". */
export function playerOf(file: string): string {
  const title = file.includes("__") ? file.split("__")[1] : file;
  const player = title.slice(0, 2);
  if (!/^\d\d_/.test(title)) throw new Error(`No GuitarSet player ID in "${file}"`);
  return player;
}

export type Part = "dev" | "test";

export function partOf(file: string, config: EvalConfig): Part {
  const player = playerOf(file);
  if (config.split.dev.includes(player)) return "dev";
  if (config.split.test.includes(player)) return "test";
  throw new Error(`Player ${player} is in neither part of the split`);
}

export function wavFiles(folder: string): string[] {
  return readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
}

export function filesOfPart(folder: string, part: Part, config: EvalConfig): string[] {
  return wavFiles(folder).filter((file) => partOf(file, config) === part);
}

// ---------- Windows: a chroma per window, computed once ----------

export type Window = { dbfs: number; chroma: Chroma | null };
export type Take = { file: string; expected: string; windows: Window[] };

function expectedOf(file: string): string {
  return expectedChord(labelFromFileName(file)) ?? NO_CHORD;
}

/** FFT chroma of every window, cut exactly like scripts/evaluate.ts. */
export function dspTakes(folder: string, files: string[]): Take[] {
  const detector = new ChordDetector(CHORD_FRAME_SIZE);
  return files.map((file) => {
    const { samples, sampleRate } = decodeWav(readFileSync(`${folder}/${file}`).buffer as ArrayBuffer);
    const windows = windowStarts(samples.length, CHORD_FRAME_SIZE, sampleRate).map((start) => {
      // The chroma does not depend on the rules, only the decision does.
      const reading = detector.analyze(samples.slice(start, start + CHORD_FRAME_SIZE), sampleRate);
      return { dbfs: reading.dbfs, chroma: reading.chroma };
    });
    return { file, expected: expectedOf(file), windows };
  });
}

/** Basic Pitch note activity of every window (cached), turned into chroma with `floor`. */
export async function aiOutputs(folder: string, files: string[]) {
  const outputs = [];
  for (const file of files) {
    outputs.push({ file, expected: expectedOf(file), windows: await networkOutput(folder, file) });
    process.stdout.write(`\rnetwork: ${folder} ${outputs.length}/${files.length}   `);
  }
  process.stdout.write("\n");
  return outputs;
}

export function aiTakes(outputs: Awaited<ReturnType<typeof aiOutputs>>, floor: number): Take[] {
  return outputs.map(({ file, expected, windows }) => ({
    file,
    expected,
    windows: windows.map(({ dbfs, frames }) => ({ dbfs, chroma: frames ? framesToChroma(frames, floor) : null })),
  }));
}

// ---------- Metrics ----------

export type TakeResult = {
  file: string;
  expected: string;
  answers: string[]; // one per window, "—" = no chord
  fileAnswer: string; // the most frequent chord among windows with an answer
};

export function judge(takes: Take[], rules: Partial<ChordRules>): TakeResult[] {
  return takes.map(({ file, expected, windows }) => {
    const answers = windows.map(({ dbfs, chroma }) => {
      if (!chroma) return NO_CHORD;
      const reading = classifyChroma(chroma, dbfs, rules);
      if (reading.status !== "detected") return NO_CHORD;
      // Caug, Eaug and G♯aug are the same notes; no chroma can tell them apart.
      return sameNotes(reading.chord.name, expected) ? expected : reading.chord.name;
    });
    return { file, expected, answers, fileAnswer: mostFrequentAnswer(answers) };
  });
}

/** The chord named in most windows; windows without an answer do not count. Ties: the chord heard first. */
export function mostFrequentAnswer(answers: string[]): string {
  const counts = new Map<string, number>();
  for (const answer of answers) if (answer !== NO_CHORD) counts.set(answer, (counts.get(answer) ?? 0) + 1);
  let best = NO_CHORD;
  let bestCount = 0;
  for (const [answer, count] of counts) {
    if (count > bestCount) [best, bestCount] = [answer, count];
  }
  return best;
}

export type Metrics = {
  files: number;
  filesCorrect: number;
  windows: number;
  windowsCorrect: number;
  windowsAnswered: number; // a chord was named
  windowsWrongChord: number; // a chord was played, another one was named
  windowsFalseAlarm: number; // nothing was played (none-*), a chord was named
  filesFalseAlarm: number;
};

export function metrics(results: TakeResult[]): Metrics {
  const m: Metrics = {
    files: results.length,
    filesCorrect: 0,
    windows: 0,
    windowsCorrect: 0,
    windowsAnswered: 0,
    windowsWrongChord: 0,
    windowsFalseAlarm: 0,
    filesFalseAlarm: 0,
  };
  for (const { expected, answers, fileAnswer } of results) {
    if (fileAnswer === expected) m.filesCorrect++;
    if (expected === NO_CHORD && fileAnswer !== NO_CHORD) m.filesFalseAlarm++;
    for (const answer of answers) {
      m.windows++;
      if (answer === expected) m.windowsCorrect++;
      if (answer === NO_CHORD) continue;
      m.windowsAnswered++;
      if (answer === expected) continue;
      if (expected === NO_CHORD) m.windowsFalseAlarm++;
      else m.windowsWrongChord++;
    }
  }
  return m;
}

export const percent = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : "—");

export const metricsHeader = (first: string) => [
  `| ${first} | files | file correct ¹ | windows | window correct | windows with an answer | correct of answered | wrong chord (windows) | false alarm on none-* (windows / files) |`,
  "|---|---|---|---|---|---|---|---|---|",
];

export function metricsRow(m: Metrics): string {
  return [
    "",
    m.files,
    `${m.filesCorrect} (${percent(m.filesCorrect, m.files)})`,
    m.windows,
    `${m.windowsCorrect} (${percent(m.windowsCorrect, m.windows)})`,
    `${m.windowsAnswered} (${percent(m.windowsAnswered, m.windows)})`,
    percent(m.windowsCorrect, m.windowsAnswered),
    `${m.windowsWrongChord} (${percent(m.windowsWrongChord, m.windows)})`,
    `${m.windowsFalseAlarm} / ${m.filesFalseAlarm}`,
    "",
  ].join(" | ").trim();
}

/** Accuracy for every chord that was played, with the number of examples. */
export function perClassTable(results: TakeResult[]): string[] {
  const labels = [...new Set(results.map((r) => r.expected))].sort(byRootThenType);
  const rows = labels.map((label) => {
    const group = results.filter((r) => r.expected === label);
    const m = metrics(group);
    const top = topMistake(group);
    return `| ${label} | ${m.files} | ${m.filesCorrect} (${percent(m.filesCorrect, m.files)}) | ${m.windows} | ${percent(m.windowsCorrect, m.windows)} | ${percent(m.windowsAnswered, m.windows)} | ${top} |`;
  });
  return [
    "| played | files | file correct | windows | window correct | windows with an answer | most frequent wrong answer (windows) |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ];
}

/** Same, grouped by chord type (major, minor, 7, …). */
export function perTypeTable(results: TakeResult[]): string[] {
  const typeOf = (name: string) => findTemplate(name)?.quality ?? "no chord";
  const types = [...new Set(results.map((r) => typeOf(r.expected)))];
  const rows = types.map((type) => {
    const group = results.filter((r) => typeOf(r.expected) === type);
    const m = metrics(group);
    const sameRoot = group.filter(
      (r) => r.fileAnswer !== r.expected && r.fileAnswer !== NO_CHORD &&
        findTemplate(r.fileAnswer)?.root === findTemplate(r.expected)?.root,
    ).length;
    return `| ${type} | ${m.files} | ${m.filesCorrect} (${percent(m.filesCorrect, m.files)}) | ${sameRoot} | ${percent(m.windowsCorrect, m.windows)} | ${percent(m.windowsAnswered, m.windows)} |`;
  });
  return [
    "| type | files | file correct | file: right root, other type | window correct | windows with an answer |",
    "|---|---|---|---|---|---|",
    ...rows,
  ];
}

function topMistake(group: TakeResult[]): string {
  const counts = new Map<string, number>();
  for (const r of group) for (const a of r.answers) if (a !== r.expected) counts.set(a, (counts.get(a) ?? 0) + 1);
  const [answer, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return answer ? `${answer} (${n})` : "·";
}

function byRootThenType(a: string, b: string): number {
  const ta = findTemplate(a);
  const tb = findTemplate(b);
  if (!ta || !tb) return ta ? -1 : tb ? 1 : a.localeCompare(b);
  return ta.root - tb.root || a.localeCompare(b);
}

// ---------- The rules each engine runs with ----------

export function rulesOf(engine: EngineId, vocabulary: "basic" | "extended", config: EvalConfig): Partial<ChordRules> {
  const tuned = engine === "dsp" ? config.dsp : config.ai;
  return {
    minScore: config.fixed.minScore,
    minToneLevel: config.fixed.minToneLevel,
    vocabulary,
    extendedMargin: tuned.extendedMargin,
    powerMargin: tuned.powerMargin,
    fallback: tuned.fallback,
  };
}

/** The app must run with the evaluated values, otherwise the report is about another program. */
export function appMatchesConfig(config: EvalConfig): string[] {
  const problems: string[] = [];
  const check = (name: string, app: unknown, frozen: unknown) => {
    if (app !== frozen) problems.push(`${name}: app ${String(app)}, config ${String(frozen)}`);
  };
  for (const key of ["extendedMargin", "powerMargin", "fallback"] as const) {
    check(`DEFAULT_RULES.${key}`, DEFAULT_RULES[key], config.dsp[key]);
    check(`BASIC_PITCH_RULES.${key}`, BASIC_PITCH_RULES[key], config.ai[key]);
  }
  check("DEFAULT_ACTIVATION_FLOOR", DEFAULT_ACTIVATION_FLOOR, config.ai.activationFloor);
  check("MIN_CHORD_DBFS", MIN_CHORD_DBFS, config.fixed.minChordDbfs);
  check("DEFAULT_RULES.minScore", DEFAULT_RULES.minScore, config.fixed.minScore);
  check("DEFAULT_RULES.minToneLevel", DEFAULT_RULES.minToneLevel, config.fixed.minToneLevel);
  check("BASIC_PITCH_RULES.minScore", BASIC_PITCH_RULES.minScore, config.fixed.minScore);
  check("BASIC_PITCH_RULES.minToneLevel", BASIC_PITCH_RULES.minToneLevel, config.fixed.minToneLevel);
  return problems;
}

// ---------- What every report must say about itself ----------

export function runInfo(): string[] {
  const git = (cmd: string) => {
    try {
      return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
    } catch {
      return "?";
    }
  };
  const dirty = git("status --porcelain -- src scripts") ? " (with uncommitted changes in src/ or scripts/)" : "";
  const model = readFileSync("node_modules/@spotify/basic-pitch/model/model.json");
  const version = (pkg: string) => JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8")).version;
  return [
    `| | |`,
    `|---|---|`,
    `| Commit | \`${git("rev-parse --short=7 HEAD")}\`${dirty} |`,
    `| Configuration | \`${CONFIG_PATH}\` (sha256 \`${sha256(readFileSync(CONFIG_PATH)).slice(0, 12)}\`) |`,
    `| AI model | Basic Pitch, @spotify/basic-pitch ${version("@spotify/basic-pitch")}, model.json sha256 \`${sha256(model).slice(0, 12)}\`; TensorFlow.js ${version("@tensorflow/tfjs")} (CPU) |`,
    `| Hardware | ${cpus()[0].model.trim()}, ${cpus().length} threads, ${Math.round(totalmem() / 2 ** 30)} GB RAM; Windows NT ${release()}; Node ${process.version} |`,
  ];
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** The recordings behind a list of segment files, so the input can be named exactly. */
export function inputSummary(folder: string, files: string[]): string {
  const listHash = `file list sha256 \`${sha256(files.join("\n")).slice(0, 12)}\``;
  const titles = files.map((f) => f.split("__")[1]).filter((t) => /^\d\d_/.test(t));
  if (titles.length === files.length) {
    const recordings = new Set(titles.map((t) => t.replace(/_\d+\.wav$/i, "")));
    const players = [...new Set(titles.map((t) => t.slice(0, 2)))].sort().join(", ");
    return `\`${folder}\`: ${files.length} files from ${recordings.size} recordings, players ${players} (${listHash})`;
  }
  // Own recordings: how many takes of each label.
  const perLabel = new Map<string, number>();
  for (const f of files) perLabel.set(labelFromFileName(f), (perLabel.get(labelFromFileName(f)) ?? 0) + 1);
  const labels = [...perLabel].map(([label, n]) => `${label} ${n}`).join(", ");
  return `\`${folder}\`: ${files.length} files (${labels}) (${listHash})`;
}
