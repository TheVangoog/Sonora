import { test } from "node:test";
import assert from "node:assert/strict";
import { fft } from "../src/audio/fft.ts";
import { magnitudeSpectrum } from "../src/audio/spectrum.ts";

// Brute-force DFT as the reference.
function slowDft(samples: number[]) {
  const n = samples.length;
  return samples.map((_, k) => {
    let re = 0;
    let im = 0;
    samples.forEach((x, i) => {
      re += x * Math.cos((2 * Math.PI * k * i) / n);
      im -= x * Math.sin((2 * Math.PI * k * i) / n);
    });
    return { re, im };
  });
}

test("FFT gives exactly the same arrows as the slow DFT", () => {
  for (const n of [1, 2, 4, 8, 64, 256]) {
    const samples = Array.from({ length: n }, (_, i) => Math.sin(i * 1.3) + 0.4 * Math.cos(i * 0.7));
    const fast = fft(samples);
    const slow = slowDft(samples);
    fast.forEach((arrow, k) => {
      assert.ok(Math.abs(arrow.re - slow[k].re) < 1e-9, `n=${n}, k=${k}, re`);
      assert.ok(Math.abs(arrow.im - slow[k].im) < 1e-9, `n=${n}, k=${k}, im`);
    });
  }
});

test("FFT rejects lengths that are not a power of two", () => {
  assert.throws(() => fft([1, 2, 3]), /power-of-two/);
  assert.throws(() => fft([]), /power-of-two/);
});

test("a pure 440 Hz tone peaks in the bin closest to 440 Hz", () => {
  const sampleRate = 48000;
  const samples = Array.from({ length: 8192 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / sampleRate));
  const { magnitudes, binWidthHz } = magnitudeSpectrum(samples, sampleRate);
  const peakBin = magnitudes.indexOf(Math.max(...magnitudes));
  assert.ok(Math.abs(peakBin * binWidthHz - 440) <= binWidthHz / 2);
  assert.equal(magnitudes.length, 8192 / 2 + 1);
});
