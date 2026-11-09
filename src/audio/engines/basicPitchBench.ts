import {
  BASIC_PITCH_SAMPLE_RATE,
  BASIC_PITCH_WINDOW,
  prepareRunner,
} from "./basicPitchEngine.ts";
import { loadBrowserBasicPitchModel } from "./basicPitchBrowser.ts";
import { DEMO_CHORD_VOICINGS, midiToFrequency } from "../demoChords.ts";

export type BenchResult = {
  backend: string;
  firstMs: number;
  runsMs: number[];
  averageMs: number;
  /** Time per window ÷ window length: below 1 = faster than real time. */
  realTimeFactor: number;
  tensorsLeft: number;
};

/** A 2-second synthetic Am, the same as scripts/bench-basic-pitch.ts uses. */
function testChord(): Float32Array {
  const audio = new Float32Array(BASIC_PITCH_WINDOW);
  for (const midi of DEMO_CHORD_VOICINGS.Am) {
    const f = midiToFrequency(midi);
    for (let h = 1; h <= 5; h++) {
      for (let i = 0; i < audio.length; i++) {
        audio[i] += (0.05 / h) * Math.sin((2 * Math.PI * f * h * i) / BASIC_PITCH_SAMPLE_RATE);
      }
    }
  }
  return audio;
}

/**
 * Runs the network `runs` times on the same window and measures each run.
 * The first run is reported apart: it includes one-time WebGL shader compilation.
 */
export async function benchBasicPitch(runs = 5): Promise<BenchResult> {
  const tf = await import("@tensorflow/tfjs");
  const runModel = await prepareRunner(loadBrowserBasicPitchModel);
  const audio = testChord();

  let start = performance.now();
  await runModel(audio);
  const firstMs = performance.now() - start;

  const runsMs: number[] = [];
  for (let run = 0; run < runs; run++) {
    start = performance.now();
    await runModel(audio);
    runsMs.push(performance.now() - start);
  }
  const averageMs = runsMs.reduce((a, b) => a + b, 0) / runs;
  const windowMs = (1000 * BASIC_PITCH_WINDOW) / BASIC_PITCH_SAMPLE_RATE;
  return {
    backend: tf.getBackend(),
    firstMs: Math.round(firstMs),
    runsMs: runsMs.map(Math.round),
    averageMs: Math.round(averageMs),
    realTimeFactor: Number((averageMs / windowMs).toFixed(2)),
    tensorsLeft: tf.memory().numTensors,
  };
}
