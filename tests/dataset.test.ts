import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeWav, encodeWav } from "../src/audio/wav.ts";
import { fitLength, resampleLinear } from "../src/audio/resample.ts";
import { expectedChord, labelFromFileName } from "../src/audio/datasetLabels.ts";
import { magnitudeSpectrum } from "../src/audio/spectrum.ts";
import { harteToTriad } from "../scripts/guitarsetLabels.ts";

test("WAV: what we write is what we read back (16-bit precision)", () => {
  const samples = Float32Array.from({ length: 1000 }, (_, i) => 0.8 * Math.sin(i / 7));
  const decoded = decodeWav(encodeWav(samples, 44100));
  assert.equal(decoded.sampleRate, 44100);
  assert.equal(decoded.samples.length, 1000);
  decoded.samples.forEach((value, i) => assert.ok(Math.abs(value - samples[i]) < 1e-4));
});

test("WAV: values outside −1 … +1 are clipped, not wrapped around", () => {
  const decoded = decodeWav(encodeWav(Float32Array.from([1.5, -2]), 48000));
  assert.ok(decoded.samples[0] > 0.99);
  assert.ok(decoded.samples[1] < -0.99);
});

test("WAV: anything that is not a WAV file is rejected", () => {
  assert.throws(() => decodeWav(new ArrayBuffer(64)), /Not a WAV/);
});

test("resampling 48 kHz → 22.05 kHz keeps a 440 Hz tone at 440 Hz", () => {
  const input = Float32Array.from({ length: 48000 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
  const output = resampleLinear(input, 48000, 22050);
  assert.equal(output.length, 22050);
  const { magnitudes, binWidthHz } = magnitudeSpectrum(fitLength(output, 16384), 22050);
  const peak = magnitudes.indexOf(Math.max(...magnitudes)) * binWidthHz;
  assert.ok(Math.abs(peak - 440) < binWidthHz, `peak at ${peak} Hz`);
});

test("file names carry the label; none-* means no chord is expected", () => {
  assert.equal(labelFromFileName("tests/recordings/real/Am__03.wav"), "Am");
  assert.equal(expectedChord("Am"), "Am");
  assert.equal(expectedChord(labelFromFileName("none-silence__01.wav")), null);
});

test("GuitarSet labels are reduced to Sonora's 24 triads", () => {
  assert.equal(harteToTriad("D#:maj"), "D♯");
  assert.equal(harteToTriad("A:min7"), "Am");
  assert.equal(harteToTriad("G#:maj6(*5)/1"), "G♯"); // fifth left out: still major
  assert.equal(harteToTriad("Bb:7"), "A♯"); // flats work too
  assert.equal(harteToTriad("C"), "C"); // a bare root means major
});

test("GuitarSet chords without a clear major/minor triad are skipped", () => {
  for (const label of ["N", "E:(1,5)", "G:hdim7", "D:sus4", "C:aug", "C:maj(*3)", "A:min7(*b3)"]) {
    assert.equal(harteToTriad(label), null, label);
  }
});
