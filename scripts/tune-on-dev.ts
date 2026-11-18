// Chooses the tuned chord values on the DEV part of GuitarSet only and writes
// them into scripts/chord-eval.config.json. The test part is never read here.
//
//   DSP: extendedMargin, powerMargin, fallback
//   AI:  activationFloor, extendedMargin, powerMargin, fallback
//
// Chosen on the dev part of guitarset-segments-ext with the extended vocabulary
// (the app's default, "All chords"): most (windows correct − windows with a
// wrong chord), ties → more windows correct. Afterwards copy the values into the app constants
// (tests/evalConfig.test.ts checks that they match).
//
// Run: npm run tune:dev   (needs the Basic Pitch cache, see scripts/basicPitchCache.ts)
import { mkdirSync, writeFileSync } from "node:fs";
import type { ChordRules } from "../src/audio/chords.ts";
import {
  aiOutputs,
  aiTakes,
  CONFIG_PATH,
  dspTakes,
  filesOfPart,
  inputSummary,
  judge,
  metrics,
  metricsHeader,
  metricsRow,
  readConfig,
  runInfo,
} from "./chordEval.ts";
import type { EvalConfig, Metrics, Take } from "./chordEval.ts";

// ---------- Settings ----------
const CHOOSE_ON = "tests/recordings/guitarset-segments-ext";
const ALSO_SHOW = "tests/recordings/guitarset-segments"; // dev part, basic vocabulary
// 1 = practically "never": a non-standard chord is named only if no major/minor fits at all.
const MARGINS = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 1];
const FALLBACKS = ["always", "ifHeard"] as const;
const FLOORS = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.075, 0.08, 0.09, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
const SELECTION =
  "dev part of guitarset-segments-ext, extended vocabulary (108 chords): most (windows correct − windows with a wrong chord), ties → more windows correct";

const config = readConfig();
const before: EvalConfig = structuredClone(config);
const date = new Date().toISOString().slice(0, 10);

type Tried = { label: string; m: Metrics };
// A wrong chord on the screen misleads the player, silence does not; so a wrong
// window costs as much as a correct one gains. (Most windows correct alone was
// tried first and picked rules that named a wrong chord in 29 % of the DSP
// windows: docs/results/tune-dev-2026-11-18-rejected-criterion.md.)
const net = (m: Metrics) => m.windowsCorrect - m.windowsWrongChord;
const better = (a: Tried, b: Tried) =>
  net(b.m) - net(a.m) || b.m.windowsCorrect - a.m.windowsCorrect;

function grid(takes: Take[], extra: Partial<ChordRules> = {}) {
  const tried: (Tried & { rules: Pick<ChordRules, "extendedMargin" | "powerMargin" | "fallback"> })[] = [];
  for (const fallback of FALLBACKS) {
    for (const extendedMargin of MARGINS) {
      for (const powerMargin of MARGINS) {
        const rules = { extendedMargin, powerMargin, fallback };
        const m = metrics(judge(takes, { ...fixedRules(), vocabulary: "extended", ...rules, ...extra }));
        tried.push({ label: `ext ${extendedMargin}, power ${powerMargin}, ${fallback}`, m, rules });
      }
    }
  }
  return tried;
}

function fixedRules(): Partial<ChordRules> {
  return { minScore: config.fixed.minScore, minToneLevel: config.fixed.minToneLevel };
}

const files = filesOfPart(CHOOSE_ON, "dev", config);
const lines = [
  `# Tuning on the dev part only (${date})`,
  "",
  `Split by player: dev = ${config.split.dev.join(", ")}, test = ${config.split.test.join(", ")} (never read by this script).`,
  `Chosen on: ${SELECTION}.`,
  `Input: ${inputSummary(CHOOSE_ON, files)}.`,
  "",
  ...runInfo(),
  "",
];

// ---------- DSP ----------
const dsp = dspTakes(CHOOSE_ON, files);
const dspTried = grid(dsp).sort(better);
config.dsp = dspTried[0].rules;
lines.push("## Algorithm (DSP): margins and fallback", "", `${dspTried.length} combinations, top 10:`, "", ...metricsHeader("rules"));
for (const t of dspTried.slice(0, 10)) lines.push(`| ${t.label} ${metricsRow(t.m)}`);
const dspOld = metrics(judge(dsp, { ...fixedRules(), vocabulary: "extended", ...before.dsp }));
lines.push(`| previous values (ext ${before.dsp.extendedMargin}, power ${before.dsp.powerMargin}, ${before.dsp.fallback}) ${metricsRow(dspOld)}`, "");

// ---------- AI ----------
const outputs = await aiOutputs(CHOOSE_ON, files);
const aiTried = [];
for (const floor of FLOORS) {
  const takes = aiTakes(outputs, floor);
  for (const t of grid(takes)) aiTried.push({ ...t, label: `floor ${floor}, ${t.label}`, floor });
}
aiTried.sort(better);
config.ai = { activationFloor: aiTried[0].floor, ...aiTried[0].rules };
lines.push("## AI (Basic Pitch): activation floor, margins and fallback", "", `${aiTried.length} combinations, top 10:`, "", ...metricsHeader("rules"));
for (const t of aiTried.slice(0, 10)) lines.push(`| ${t.label} ${metricsRow(t.m)}`);
const aiOld = metrics(
  judge(aiTakes(outputs, before.ai.activationFloor), { ...fixedRules(), vocabulary: "extended", ...before.ai }),
);
lines.push(
  `| previous values (floor ${before.ai.activationFloor}, ext ${before.ai.extendedMargin}, power ${before.ai.powerMargin}, ${before.ai.fallback}) ${metricsRow(aiOld)}`,
  "",
);

// ---------- Chosen values, and how they do on the rest of dev ----------
lines.push(
  "## Chosen",
  "",
  `- DSP: extendedMargin ${config.dsp.extendedMargin}, powerMargin ${config.dsp.powerMargin}, fallback ${config.dsp.fallback}`,
  `- AI: activationFloor ${config.ai.activationFloor}, extendedMargin ${config.ai.extendedMargin}, powerMargin ${config.ai.powerMargin}, fallback ${config.ai.fallback}`,
  "",
);
const basicFiles = filesOfPart(ALSO_SHOW, "dev", config);
const basicAi = await aiOutputs(ALSO_SHOW, basicFiles);
lines.push(
  `Dev part of \`${ALSO_SHOW}\` (major/minor labels), basic vocabulary (24 chords), chosen values: ${inputSummary(ALSO_SHOW, basicFiles)}`,
  "",
  ...metricsHeader("engine"),
  `| DSP ${metricsRow(metrics(judge(dspTakes(ALSO_SHOW, basicFiles), { ...fixedRules(), vocabulary: "basic", ...config.dsp })))}`,
  `| AI ${metricsRow(metrics(judge(aiTakes(basicAi, config.ai.activationFloor), { ...fixedRules(), vocabulary: "basic", ...config.ai })))}`,
  "",
  "¹ file correct = the most frequent chord among the windows with an answer is the played chord.",
);

config.selection = SELECTION;
config.tunedOn = `${date}, dev players ${config.split.dev.join(", ")}`;
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
mkdirSync("docs/results", { recursive: true });
const out = `docs/results/tune-dev-${date}.md`;
writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.join("\n"));
console.log(`\nSaved to ${out}; values written to ${CONFIG_PATH}`);
