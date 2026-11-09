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
