import type { Spectrum } from "./spectrum.ts";
import { CHROMA_MAX_HZ } from "./chroma.ts";

// How many bins on each side we look at to judge "what is normal here".
// 20 bins × 5.9 Hz ≈ ±120 Hz around each frequency.
const NEIGHBOURHOOD = 20;
// We subtract the local level once: what is left is how far a bin rises above it.
const FLOOR_FACTOR = 1;

/**
 * Subtracts the local noise level (median of neighbouring bins) so broadband
 * room noise does not lift all 12 chroma bars. String peaks are narrow and survive.
 */
export function removeNoiseFloor(
  spectrum: Spectrum,
  maxHz = CHROMA_MAX_HZ,
): Spectrum {
  const { magnitudes, binWidthHz } = spectrum;
  const cleaned = new Float64Array(magnitudes.length);

  // Chroma ignores everything above maxHz anyway, so we only clean up to there.
  // This skips ~90 % of the bins; the median of every bin is the slow part.
  const lastBin = Math.min(magnitudes.length - 1, Math.ceil(maxHz / binWidthHz));
  for (let k = 0; k <= lastBin; k++) {
    const floor = localMedian(magnitudes, k);
    cleaned[k] = Math.max(0, magnitudes[k] - FLOOR_FACTOR * floor);
  }
  return { ...spectrum, magnitudes: cleaned };
}

// Median, not mean: not pulled up by the peaks.
function localMedian(values: Float64Array, k: number): number {
  const from = Math.max(0, k - NEIGHBOURHOOD);
  const to = Math.min(values.length - 1, k + NEIGHBOURHOOD);
  const window = Array.from(values.subarray(from, to + 1)).sort((a, b) => a - b);
  return window[Math.floor(window.length / 2)];
}
