import { ChordDetector, CHORD_FRAME_SIZE } from "../chords.ts";
import type { ChordRules } from "../chords.ts";
import type { ChordEngine } from "./chordEngine.ts";

export function createDspEngine(rules: Partial<ChordRules> = {}): ChordEngine {
  const detector = new ChordDetector(CHORD_FRAME_SIZE, rules);
  return {
    id: "dsp",
    label: "Algorithm: FFT + templates",
    windowSamples: () => CHORD_FRAME_SIZE,
    // The detector is synchronous; the Promise only makes it fit the interface.
    analyze: async (samples, sampleRate, extraRules) =>
      extraRules
        ? new ChordDetector(CHORD_FRAME_SIZE, { ...rules, ...extraRules }).analyze(samples, sampleRate)
        : detector.analyze(samples, sampleRate),
  };
}
