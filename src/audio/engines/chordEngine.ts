import type { ChordReading, ChordRules } from "../chords.ts";

/** Common interface of the "dsp" and "basic-pitch" engines (UI and evaluation swap them freely). */
export type ChordEngine = {
  id: string;
  label: string;
  /** How many samples one analysis needs at this sample rate. */
  windowSamples: (sampleRate: number) => number;
  /** rules: optional changes to the engine's own rules, e.g. { vocabulary: "basic" }. */
  analyze: (
    samples: Float32Array,
    sampleRate: number,
    rules?: Partial<ChordRules>,
  ) => Promise<ChordReading>;
  /**
   * Optional one-time preparation (download a model, warm up the graphics
   * card), so that the first real answer is not slow. Safe to call many times.
   */
  prepare?: () => Promise<void>;
};

export type SafeAnalysis =
  | { ok: true; reading: ChordReading; ms: number }
  | { ok: false; error: unknown };

/** Runs one analysis and turns a thrown error into a value, so the page can fall back to the algorithm. */
export async function analyzeSafely(
  engine: ChordEngine,
  samples: Float32Array,
  sampleRate: number,
  rules?: Partial<ChordRules>,
): Promise<SafeAnalysis> {
  const started = performance.now();
  try {
    const reading = await engine.analyze(samples, sampleRate, rules);
    return { ok: true, reading, ms: performance.now() - started };
  } catch (error) {
    return { ok: false, error };
  }
}
