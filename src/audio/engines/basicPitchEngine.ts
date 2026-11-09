import type { GraphModel } from "@tensorflow/tfjs";
import { classifyChroma, DEFAULT_RULES, emptyReading, MIN_CHORD_DBFS } from "../chords.ts";
import type { ChordRules } from "../chords.ts";
import type { Chroma } from "../chroma.ts";
import { measureSignal } from "../signal.ts";
import { fitLength, resampleLinear } from "../resample.ts";
import type { ChordEngine } from "./chordEngine.ts";

// Basic Pitch (Spotify, Apache-2.0) was trained on audio at 22 050 Hz and
// always looks at windows of 43 844 samples (≈ 2 s).
export const BASIC_PITCH_SAMPLE_RATE = 22050;
export const BASIC_PITCH_WINDOW = 43844;
// Its output has 88 rows: one per piano key, from A0 (MIDI 21) up.
const LOWEST_MIDI = 21;
// Note activity (0 … 1) below this counts as "not playing". The library default
// 0.25 stayed silent on many real chords; 0.075 is tuned with
// `npm run tune:basic-pitch` (docs/results/tune-basic-pitch-2026-11-07.md).
export const DEFAULT_ACTIVATION_FLOOR = 0.075;

// ChordRules for this engine (tuned: docs/results/tune-chord-rules-*.md).
// The network reports notes without harmonics, so small margins are enough.
export const BASIC_PITCH_RULES: ChordRules = {
  ...DEFAULT_RULES,
  extendedMargin: 0.02,
  powerMargin: 0.06,
  fallback: "ifHeard",
};

/**
 * Resample to 22 050 Hz → network → note activity per frame → chroma →
 * classifyChroma(). `loadModel` differs between the browser and Node.
 */
export function createBasicPitchEngine(
  loadModel: () => Promise<GraphModel>,
  activationFloor = DEFAULT_ACTIVATION_FLOOR,
  rules: Partial<ChordRules> = {},
): ChordEngine {
  const engineRules = { ...BASIC_PITCH_RULES, ...rules };
  // The library and the model are big; load them only on first use.
  let ready: Promise<RunModel> | null = null;
  const getRunner = () => (ready ??= prepareRunner(loadModel));
  // The first WebGL run compiles shaders (~10 s); warm up on silence.
  let warmedUp: Promise<void> | null = null;

  return {
    id: "basic-pitch",
    label: "AI: Basic Pitch",
    windowSamples: (sampleRate) =>
      Math.round((BASIC_PITCH_WINDOW / BASIC_PITCH_SAMPLE_RATE) * sampleRate),
    analyze: async (samples, sampleRate, rules = {}) => {
      const dbfs = measureSignal(samples).dbfs;
      if (dbfs < MIN_CHORD_DBFS) return emptyReading("quiet", dbfs);

      const frames = await runBasicPitch(await getRunner(), samples, sampleRate);
      return classifyChroma(framesToChroma(frames, activationFloor), dbfs, { ...engineRules, ...rules });
    },
    prepare: () =>
      (warmedUp ??= getRunner().then(async (runModel) => {
        await runModel(new Float32Array(BASIC_PITCH_WINDOW));
      }).catch((error) => {
        // E.g. the model could not be downloaded: allow a new try next time.
        warmedUp = null;
        ready = null;
        throw error;
      })),
  };
}

/** Resample, cut to the model's window and run the network → note activity per frame. */
export async function runBasicPitch(
  runModel: RunModel,
  samples: Float32Array,
  sampleRate: number,
): Promise<number[][]> {
  const audio = fitLength(
    resampleLinear(samples, sampleRate, BASIC_PITCH_SAMPLE_RATE),
    BASIC_PITCH_WINDOW,
  );
  return runModel(audio);
}

export type RunModel = (audio: Float32Array) => Promise<number[][]>;

// Names of the model's outputs. We need only "frames" (which notes sound).
// "onsets" (where notes start) and "contours" are for MIDI export.
const FRAMES_OUTPUT = "Identity_1";
// Output frames per window: one per 256 samples, as the library counts them.
const FRAMES_PER_WINDOW = Math.floor((BASIC_PITCH_WINDOW * 86) / BASIC_PITCH_SAMPLE_RATE);

/**
 * Calls the model directly instead of the library's evaluateModel(), which
 * pads the window (two network passes), computes unused outputs and leaks
 * tensors. Same frames as the library (checked).
 */
export async function prepareRunner(
  loadModel: () => Promise<GraphModel>,
): Promise<RunModel> {
  const tf = await import("@tensorflow/tfjs");
  const model = await loadModel();
  return async (audio) => {
    // tidy() frees every temporary tensor made inside it; only `frames` stays.
    const frames = tf.tidy(() => {
      const input = tf.tensor3d(audio, [1, audio.length, 1]);
      const output = model.execute(input, FRAMES_OUTPUT) as import("@tensorflow/tfjs").Tensor;
      return output.squeeze([0]).slice([0, 0], [FRAMES_PER_WINDOW, -1]);
    });
    const values = (await frames.array()) as number[][];
    frames.dispose();
    return values;
  };
}

/** The whole step: frames of note activity → chroma. Exported for tuning the floor. */
export function framesToChroma(frames: number[][], activationFloor: number): Chroma {
  return notesToChroma(averageActivation(frames, activationFloor));
}

/** For each of the 88 notes: average activity above the floor over all frames. */
function averageActivation(frames: number[][], activationFloor: number): number[] {
  const average = new Array<number>(88).fill(0);
  for (const frame of frames) {
    frame.forEach((value, note) => {
      average[note] += Math.max(0, value - activationFloor) / frames.length;
    });
  }
  return average;
}

/** Fold 88 notes into 12 pitch classes; the strongest class becomes 1. */
function notesToChroma(noteActivity: number[]): Chroma {
  const chroma = new Array<number>(12).fill(0);
  noteActivity.forEach((value, index) => {
    chroma[(LOWEST_MIDI + index) % 12] += value;
  });
  const strongest = Math.max(...chroma);
  return strongest > 0 ? chroma.map((value) => value / strongest) : chroma;
}
