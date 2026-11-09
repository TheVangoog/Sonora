// How fast is the Basic Pitch network on this computer (Node, CPU)?
// The first run (one-time setup) is reported separately.
//
// Run: npm run bench:basic-pitch
// For the browser, see docs/AI-BASIC-PITCH.md ("Result 2: speed" section).
import * as tf from "@tensorflow/tfjs";
import {
  BASIC_PITCH_SAMPLE_RATE,
  BASIC_PITCH_WINDOW,
  prepareRunner,
} from "../src/audio/engines/basicPitchEngine.ts";
import { DEMO_CHORD_VOICINGS, midiToFrequency } from "../src/audio/demoChords.ts";
import { loadBasicPitchModelFromDisk } from "./basicPitchModel.ts";

const RUNS = 5;

// A simple strummed Am: every string with a few harmonics.
const audio = new Float32Array(BASIC_PITCH_WINDOW);
for (const midi of DEMO_CHORD_VOICINGS.Am) {
  const f = midiToFrequency(midi);
  for (let h = 1; h <= 5; h++) {
    for (let i = 0; i < audio.length; i++) {
      audio[i] += (0.05 / h) * Math.sin((2 * Math.PI * f * h * i) / BASIC_PITCH_SAMPLE_RATE);
    }
  }
}

const runModel = await prepareRunner(loadBasicPitchModelFromDisk);
await tf.ready();

let start = performance.now();
const frames = await runModel(audio);
const firstMs = performance.now() - start;

const times: number[] = [];
for (let run = 0; run < RUNS; run++) {
  start = performance.now();
  await runModel(audio);
  times.push(performance.now() - start);
}
const average = times.reduce((a, b) => a + b, 0) / times.length;
const windowSeconds = BASIC_PITCH_WINDOW / BASIC_PITCH_SAMPLE_RATE;

console.log(`backend: ${tf.getBackend()}`);
console.log(`frames per window: ${frames.length}`);
console.log(`first run: ${firstMs.toFixed(0)} ms`);
console.log(`next ${RUNS} runs: ${times.map((t) => t.toFixed(0)).join(", ")} ms`);
console.log(`average: ${average.toFixed(0)} ms per ${windowSeconds.toFixed(2)} s window ` +
  `(real-time factor ${(average / 1000 / windowSeconds).toFixed(2)})`);
console.log(`tensors still in memory: ${tf.memory().numTensors}`);
