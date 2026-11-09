// The evaluation stand: runs every engine over every WAV file in a folder
// and reports accuracy, a confusion matrix and speed.
//
// Run:  npm run eval                       (real recordings)
//       npm run eval:synthetic             (synthetic set, to check the stand)
//       npm run eval:guitarset[-ext]        (GuitarSet; -ext = also 7, maj7, m7, m7♭5, aug, 5)
//       node scripts/evaluate.ts <folder> [dsp,basic-pitch]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeWav } from "../src/audio/wav.ts";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { createDspEngine } from "../src/audio/engines/dspEngine.ts";
import { createBasicPitchEngine } from "../src/audio/engines/basicPitchEngine.ts";
import type { ChordEngine } from "../src/audio/engines/chordEngine.ts";
import { findTemplate, sameNotes } from "../src/audio/chordTemplates.ts";
import { loadBasicPitchModelFromDisk } from "./basicPitchModel.ts";

// ---------- Settings ----------
const folder = process.argv[2] ?? "tests/recordings/real";
const engineIds = (process.argv[3] ?? "dsp,basic-pitch").split(",");
// Skip the first moment of each take: the pick attack is noise, not a chord.
const SKIP_SECONDS = 0.3;
// At most this many windows per file (Basic Pitch on a CPU is slow).
const MAX_WINDOWS_PER_FILE = 12;
const NO_CHORD = "—";

const ENGINES: Record<string, () => ChordEngine> = {
  dsp: createDspEngine,
  "basic-pitch": () => createBasicPitchEngine(loadBasicPitchModelFromDisk),
};

// ---------- One file through one engine ----------
type FileResult = {
  file: string;
  expected: string; // chord name or "—"
  predicted: string; // majority vote of the windows
  windowsCorrect: number;
  windowsTotal: number;
  milliseconds: number[]; // time of each analysis
};

async function evaluateFile(engine: ChordEngine, path: string, file: string): Promise<FileResult> {
  const { samples, sampleRate } = decodeWav(readFileSync(path).buffer as ArrayBuffer);
  const expected = expectedChord(labelFromFileName(file)) ?? NO_CHORD;
  const window = engine.windowSamples(sampleRate);

  // Cut the take into windows that do not overlap.
  const starts: number[] = [];
  for (let start = Math.round(SKIP_SECONDS * sampleRate); start + window <= samples.length; start += window) {
    starts.push(start);
  }
  const chosen = starts.slice(0, MAX_WINDOWS_PER_FILE);

  const votes = new Map<string, number>();
  const milliseconds: number[] = [];
  let windowsCorrect = 0;
  for (const start of chosen) {
    const begin = performance.now();
    const reading = await engine.analyze(samples.slice(start, start + window), sampleRate);
    milliseconds.push(performance.now() - begin);
    let answer = reading.status === "detected" ? reading.chord.name : NO_CHORD;
    // Caug, Eaug and G♯aug are the same three notes: no chroma can tell them
    // apart, so such an answer counts as the expected chord.
    if (sameNotes(answer, expected)) answer = expected;
    if (answer === expected) windowsCorrect++;
    if (answer !== NO_CHORD) votes.set(answer, (votes.get(answer) ?? 0) + 1);
  }

  // The file's answer: the chord most windows agreed on, or "—" if none found one.
  const predicted = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NO_CHORD;
  return { file, expected, predicted, windowsCorrect, windowsTotal: chosen.length, milliseconds };
}

// ---------- Report ----------
function report(engine: ChordEngine, results: FileResult[], sampleRate: number): string {
  const correctFiles = results.filter((r) => r.predicted === r.expected).length;
  const windowsCorrect = results.reduce((s, r) => s + r.windowsCorrect, 0);
  const windowsTotal = results.reduce((s, r) => s + r.windowsTotal, 0);
  const times = results.flatMap((r) => r.milliseconds);
  const meanMs = times.reduce((s, t) => s + t, 0) / Math.max(1, times.length);
  const windowMs = (engine.windowSamples(sampleRate) / sampleRate) * 1000;
  const percent = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : "—");

  // Confusion matrix: rows = what was played, columns = what the engine said.
  const labels = [...new Set(results.flatMap((r) => [r.expected, r.predicted]))].sort();
  const matrix = labels.map((row) =>
    labels.map((col) => results.filter((r) => r.expected === row && r.predicted === col).length),
  );
  const mistakes = results.filter((r) => r.predicted !== r.expected);
  // A matrix of 70 chords is unreadable; above 30 labels only the type table is shown.
  const showMatrix = labels.length <= 30;

  return [
    `## ${engine.label} (\`${engine.id}\`)`,
    "",
    `| Metric | Value |`,
    `|---|---|`,
    `| Files correct | ${correctFiles} / ${results.length} (${percent(correctFiles, results.length)}) |`,
    `| Windows correct | ${windowsCorrect} / ${windowsTotal} (${percent(windowsCorrect, windowsTotal)}) |`,
    `| Window length | ${windowMs.toFixed(0)} ms |`,
    `| Mean analysis time per window (Node, CPU) | ${meanMs.toFixed(1)} ms |`,
    `| Real-time factor (time ÷ window length; < 1 = keeps up) | ${(meanMs / windowMs).toFixed(2)} |`,
    "",
    ...byTypeTable(results),
    ...(showMatrix
      ? [
          "Confusion matrix (rows: played, columns: recognized):",
          "",
          `| played ＼ recognized | ${labels.join(" | ")} |`,
          `|---|${labels.map(() => "---").join("|")}|`,
          ...labels.map((label, i) => `| **${label}** | ${matrix[i].map((n) => (n ? String(n) : "·")).join(" | ")} |`),
          "",
        ]
      : [`Confusion matrix left out: ${labels.length} different chords.`, ""]),
    mistakes.length
      ? `Mistakes: ${mistakes.map((r) => `${r.file} → ${r.predicted}`).join(", ")}`
      : "No mistakes.",
    "",
  ].join("\n");
}

// Results per chord type: is the engine good at triads but bad at seventh chords?
// "right root, other type" = e.g. G7 played, G or Gmaj7 recognized.
function byTypeTable(results: FileResult[]): string[] {
  const typeOf = (name: string) => findTemplate(name)?.quality ?? "no chord";
  const types = [...new Set(results.map((r) => typeOf(r.expected)))];
  if (types.length < 2) return [];
  const rows = types.map((type) => {
    const group = results.filter((r) => typeOf(r.expected) === type);
    const correct = group.filter((r) => r.predicted === r.expected).length;
    const silent = group.filter((r) => r.predicted !== r.expected && r.predicted === NO_CHORD).length;
    const sameRoot = group.filter(
      (r) => r.predicted !== r.expected && findTemplate(r.predicted)?.root === findTemplate(r.expected)?.root,
    ).length;
    const other = group.length - correct - silent - sameRoot;
    return `| ${type} | ${group.length} | ${correct} (${((100 * correct) / group.length).toFixed(0)} %) | ${sameRoot} | ${silent} | ${other} |`;
  });
  return [
    "By chord type:",
    "",
    "| type | files | correct | right root, other type | silent | other chord |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ];
}

// ---------- Main ----------
const files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
if (!files.length) {
  console.error(`No .wav files in ${folder}. Record some on the /#/record page.`);
  process.exit(1);
}
const firstRate = decodeWav(readFileSync(`${folder}/${files[0]}`).buffer as ArrayBuffer).sampleRate;

const sections: string[] = [];
for (const id of engineIds) {
  const engine = ENGINES[id]();
  const results: FileResult[] = [];
  for (const file of files) {
    results.push(await evaluateFile(engine, `${folder}/${file}`, file));
    process.stdout.write(`\r${engine.id}: ${results.length}/${files.length}`);
  }
  process.stdout.write("\n");
  sections.push(report(engine, results, firstRate));
}

const date = new Date().toISOString().slice(0, 10);
const name = folder.split("/").filter(Boolean).pop();
const text = [
  `# Evaluation: ${name} (${date})`,
  "",
  `Folder \`${folder}\`, ${files.length} files. Each take is cut into non-overlapping windows after the first ${SKIP_SECONDS} s; the file's answer is the majority vote of its windows. "—" = no chord.`,
  "",
  ...sections,
].join("\n");
mkdirSync("docs/results", { recursive: true });
const out = `docs/results/eval-${name}-${date}.md`;
writeFileSync(out, text);
console.log(text);
console.log(`\nSaved to ${out}`);
