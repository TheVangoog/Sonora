import type { Spectrum } from "./spectrum.ts";

/** 12 pitch classes (C … B), octaves folded, strongest = 1. */
export type Chroma = number[];

// Below 82 Hz is mostly hum, above ~2 kHz mostly harmonics and noise.
export const CHROMA_MIN_HZ = 70;
export const CHROMA_MAX_HZ = 2000;

/** 0 = C … 11 = B. */
export function pitchClassOf(frequency: number, referenceA4 = 440): number {
  const midi = Math.round(69 + 12 * Math.log2(frequency / referenceA4));
  return ((midi % 12) + 12) % 12;
}

export function spectrumToChroma(
  spectrum: Spectrum,
  referenceA4 = 440,
): Chroma {
  const energy = new Array<number>(12).fill(0);

  // Bin 0 is 0 Hz (the constant part), so we start from bin 1.
  for (let k = 1; k < spectrum.magnitudes.length; k++) {
    const frequency = k * spectrum.binWidthHz;
    if (frequency < CHROMA_MIN_HZ || frequency > CHROMA_MAX_HZ) continue;

    // Sum energy, not magnitude: many bins can share one note.
    const magnitude = spectrum.magnitudes[k];
    energy[pitchClassOf(frequency, referenceA4)] += magnitude * magnitude;
  }

  // Back from energy to magnitude, then scale so the strongest class is 1.
  const strength = energy.map(Math.sqrt);
  const strongest = Math.max(...strength);
  if (strongest === 0) return strength;
  return strength.map((value) => value / strongest);
}
