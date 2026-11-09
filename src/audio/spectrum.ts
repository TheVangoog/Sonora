import { fft } from "./fft.ts";

/**
 * Strength of every frequency bin from 0 Hz up to half the sample rate.
 * magnitudes[k] belongs to the frequency k × binWidthHz.
 */
export type Spectrum = {
  magnitudes: Float64Array;
  binWidthHz: number;
};

/** Hann window: reduces spectral leakage from the frame edges. */
export function hannWindow(length: number): Float64Array {
  const window = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return window;
}

export function magnitudeSpectrum(
  samples: ArrayLike<number>,
  sampleRate: number,
): Spectrum {
  const window = hannWindow(samples.length);
  const windowed = Array.from(samples, (sample, i) => sample * window[i]);

  const arrows = fft(windowed);

  // Bins above n/2 mirror the ones below for a real signal, so we keep only
  // the first half (plus the middle bin).
  const binCount = samples.length / 2 + 1;
  const magnitudes = new Float64Array(binCount);
  for (let k = 0; k < binCount; k++) {
    magnitudes[k] = Math.hypot(arrows[k].re, arrows[k].im);
  }

  return { magnitudes, binWidthHz: sampleRate / samples.length };
}
