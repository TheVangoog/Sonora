// The one run on the TEST part of GuitarSet with the frozen configuration
// (scripts/chord-eval.config.json), plus our own recordings as an extra check.
// Nothing is tuned here. It refuses to run if the app's constants differ from
// the configuration, so the report is about the program that is deployed.
//
//   guitarset-segments, test part      → basic vocabulary (24 major/minor chords)
//   guitarset-segments-ext, test part  → extended vocabulary (108 chords, "All chords")
//   own recordings (tests/recordings/real) → both vocabularies
//
// The AI answers come from the Basic Pitch cache (scripts/basicPitchCache.ts);
// a few test files are run through the network again to show the cache is current.
//
// Run: npm run eval:test
import { mkdirSync, writeFileSync } from "node:fs";
import { decodeWav } from "../src/audio/wav.ts";
import { readFileSync } from "node:fs";
import { BASIC_PITCH_SAMPLE_RATE, BASIC_PITCH_WINDOW, prepareRunner, runBasicPitch } from "../src/audio/engines/basicPitchEngine.ts";
import { MIN_CHORD_DBFS } from "../src/audio/chords.ts";
import { measureSignal } from "../src/audio/signal.ts";
import { loadBasicPitchModelFromDisk } from "./basicPitchModel.ts";
import { MAX_WINDOWS_PER_FILE, networkOutput, SKIP_SECONDS, windowStarts } from "./basicPitchCache.ts";
import {
  aiOutputs,
  aiTakes,
  appMatchesConfig,
  CONFIG_PATH,
  dspTakes,
  filesOfPart,
  inputSummary,
  judge,
  metrics,
  metricsHeader,
  metricsRow,
  perClassTable,
  perTypeTable,
  readConfig,
  rulesOf,
  runInfo,
  wavFiles,
} from "./chordEval.ts";
import type { EngineId, Take, TakeResult } from "./chordEval.ts";

const config = readConfig();
const problems = appMatchesConfig(config);
if (problems.length) {
  console.error(`The app does not run with the configuration in ${CONFIG_PATH}:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

type Run = { set: string; folder: string; files: string[]; vocabulary: "basic" | "extended" };
const RUNS: Run[] = [
  { set: "GuitarSet test, major/minor labels", folder: "tests/recordings/guitarset-segments", files: [], vocabulary: "basic" },
  { set: "GuitarSet test, extended labels", folder: "tests/recordings/guitarset-segments-ext", files: [], vocabulary: "extended" },
  { set: "Own recordings (extra check)", folder: "tests/recordings/real", files: [], vocabulary: "basic" },
  { set: "Own recordings (extra check)", folder: "tests/recordings/real", files: [], vocabulary: "extended" },
];
for (const run of RUNS) {
  run.files = run.folder.endsWith("real") ? wavFiles(run.folder) : filesOfPart(run.folder, "test", config);
}

const VOCABULARY = { basic: "basic, 24 major/minor chords", extended: "extended, 108 chords (\"All chords\" in the app)" };
const ENGINES: { id: EngineId; name: string }[] = [
  { id: "dsp", name: "Algorithm (DSP)" },
  { id: "ai", name: "AI (Basic Pitch)" },
];

// ---------- Is the cached network output still what the network gives? ----------
async function checkCache(folder: string, files: string[]): Promise<string> {
  const runModel = await prepareRunner(loadBasicPitchModelFromDisk);
  let largest = 0;
  for (const file of files) {
    const cached = await networkOutput(folder, file);
    const { samples, sampleRate } = decodeWav(readFileSync(`${folder}/${file}`).buffer as ArrayBuffer);
    const window = Math.round((BASIC_PITCH_WINDOW / BASIC_PITCH_SAMPLE_RATE) * sampleRate);
    const starts = windowStarts(samples.length, window, sampleRate);
    for (let i = 0; i < starts.length; i++) {
      const piece = samples.slice(starts[i], starts[i] + window);
      if (measureSignal(piece).dbfs < MIN_CHORD_DBFS) continue;
      const fresh = await runBasicPitch(runModel, piece, sampleRate);
      fresh.forEach((frame, f) =>
        frame.forEach((v, n) => (largest = Math.max(largest, Math.abs(v - (cached[i].frames?.[f][n] ?? NaN))))),
      );
    }
  }
  return `${files.length} test files run through the network again: largest difference to the cache ${largest.toFixed(4)} (the cache keeps 3 decimals).`;
}

// ---------- Run ----------
const date = new Date().toISOString().slice(0, 10);
const summary: string[] = [];
const details: string[] = [];
const dspCache = new Map<string, Take[]>();
const aiCache = new Map<string, Awaited<ReturnType<typeof aiOutputs>>>();

for (const run of RUNS) {
  dspCache.set(run.folder, dspCache.get(run.folder) ?? dspTakes(run.folder, run.files));
  aiCache.set(run.folder, aiCache.get(run.folder) ?? (await aiOutputs(run.folder, run.files)));
  for (const engine of ENGINES) {
    const takes =
      engine.id === "dsp" ? dspCache.get(run.folder)! : aiTakes(aiCache.get(run.folder)!, config.ai.activationFloor);
    const results: TakeResult[] = judge(takes, rulesOf(engine.id, run.vocabulary, config));
    const title = `${run.set} · ${VOCABULARY[run.vocabulary]} · ${engine.name}`;
    summary.push(`| ${run.set} | ${run.vocabulary} | ${engine.name} ${metricsRow(metrics(results))}`);
    details.push(`### ${title}`, "", "By chord type:", "", ...perTypeTable(results), "", "By chord:", "", ...perClassTable(results), "");
  }
}

const cacheCheck = await checkCache("tests/recordings/guitarset-segments-ext", RUNS[1].files.slice(0, 5));

const inputs = RUNS.filter((r, i) => RUNS.findIndex((o) => o.folder === r.folder) === i);
const text = [
  `# Chord recognition on the test part (${date})`,
  "",
  "One run with the configuration frozen on the dev part (`docs/results/tune-dev-2026-11-18.md`). Nothing below was used to choose any value.",
  "",
  "## Run",
  "",
  ...runInfo(),
  `| Split | by GuitarSet player: dev ${config.split.dev.join(", ")}, test ${config.split.test.join(", ")} |`,
  `| Thresholds (DSP) | minScore ${config.fixed.minScore}, minToneLevel ${config.fixed.minToneLevel}, minChordDbfs ${config.fixed.minChordDbfs}; extendedMargin ${config.dsp.extendedMargin}, powerMargin ${config.dsp.powerMargin}, fallback ${config.dsp.fallback} |`,
  `| Thresholds (AI) | activationFloor ${config.ai.activationFloor}; minScore ${config.fixed.minScore}, minToneLevel ${config.fixed.minToneLevel}, minChordDbfs ${config.fixed.minChordDbfs}; extendedMargin ${config.ai.extendedMargin}, powerMargin ${config.ai.powerMargin}, fallback ${config.ai.fallback} |`,
  `| Windows | first ${SKIP_SECONDS} s skipped, then non-overlapping windows, at most ${MAX_WINDOWS_PER_FILE} per file; DSP window 8192 samples (≈ 186 ms at 44.1 kHz), AI window ≈ 1.99 s |`,
  `| AI cache check | ${cacheCheck} |`,
  "",
  "Inputs:",
  "",
  ...inputs.map((r) => `- ${inputSummary(r.folder, r.files)}`),
  "",
  "## Results",
  "",
  "¹ **file correct** = the most frequent chord among the windows with an answer is the played chord (windows without an answer do not count; ties: the chord heard first). ",
  "**wrong chord** = a chord was played and another one was named. **false alarm** = nothing was played (`none-*` takes, only in own recordings) and a chord was named. ",
  "Major/minor labels are scored with the basic vocabulary and extended labels with the extended one, so every played chord can be named.",
  "",
  ...metricsHeader("set | vocabulary | engine").map((l, i) => (i === 1 ? "|---|---|" + l.slice(1) : l)),
  ...summary,
  "",
  "## Details",
  "",
  ...details,
].join("\n");

mkdirSync("docs/results", { recursive: true });
const out = `docs/results/eval-test-${date}.md`;
writeFileSync(out, text + "\n");
console.log(text);
console.log(`\nSaved to ${out}`);
