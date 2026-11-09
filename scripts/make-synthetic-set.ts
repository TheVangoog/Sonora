// Generates a SYNTHETIC test set in tests/recordings/synthetic/.
// It only checks that the evaluation stand works; real conclusions need
// real recordings (tests/recordings/real/, recorded on the /#/record page).
//
// Run: npm run make:synthetic
import { mkdirSync, writeFileSync } from "node:fs";
import { encodeWav } from "../src/audio/wav.ts";
import { DEMO_CHORD_VOICINGS, midiToFrequency } from "../src/audio/demoChords.ts";
import { CHORD_LABELS } from "../src/audio/datasetLabels.ts";

const OUT_DIR = "tests/recordings/synthetic";
const SAMPLE_RATE = 48000;
const SECONDS = 3;

// Deterministic random numbers, so the set is the same every time.
function makeRandom(seed: number) {
  let state = seed * 9301 + 49297;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

// A strummed chord: every string has 12 slightly out-of-tune, slightly
// inharmonic overtones and dies away; a laptop mic weakens the deep bass.
function strum(midis: number[], level: number, seed: number): Float32Array {
  const random = makeRandom(seed);
  const samples = new Float32Array(SAMPLE_RATE * SECONDS);
  midis.forEach((midi, string) => {
    const start = Math.round((0.05 + string * 0.012) * SAMPLE_RATE); // strum from low to high
    const frequency = midiToFrequency(midi) * 2 ** (((random() - 0.5) * 16) / 1200);
    const stringLevel = 0.4 + 0.6 * random();
    for (let h = 1; h <= 12; h++) {
      const f = h * frequency * Math.sqrt(1 + 0.0003 * h * h);
      if (f > 8000) break;
      const micResponse = f < 150 ? (f / 150) ** 2 : 1;
      const amplitude = ((level / midis.length) * stringLevel * micResponse) / h ** 0.9;
      const decayPerSecond = 0.8 + 0.25 * h; // high overtones fade faster
      const phase = random() * 2 * Math.PI;
      for (let i = start; i < samples.length; i++) {
        const t = (i - start) / SAMPLE_RATE;
        samples[i] += amplitude * Math.exp(-decayPerSecond * t) * Math.sin(2 * Math.PI * f * t + phase);
      }
    }
  });
  return samples;
}

// Room background: soft rumble + 50 Hz mains hum with harmonics.
function room(seed: number, level = 0.006): Float32Array {
  const random = makeRandom(seed + 1000);
  const samples = new Float32Array(SAMPLE_RATE * SECONDS);
  let rumble = 0;
  for (let i = 0; i < samples.length; i++) {
    rumble = 0.995 * rumble + 0.05 * (random() * 2 - 1);
    samples[i] = level * (rumble + 0.3 * (random() * 2 - 1));
    for (let h = 1; h <= 7; h++) {
      samples[i] += (level / 2 / h) * Math.sin((2 * Math.PI * 50 * h * i) / SAMPLE_RATE);
    }
  }
  return samples;
}

const add = (a: Float32Array, b: Float32Array) => a.map((value, i) => value + b[i]);
const save = (name: string, samples: Float32Array) =>
  writeFileSync(`${OUT_DIR}/${name}.wav`, new Uint8Array(encodeWav(samples, SAMPLE_RATE)));

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
CHORD_LABELS.forEach((label, chordIndex) => {
  [0.4, 0.15, 0.05].forEach((level, take) => {
    const seed = chordIndex * 10 + take;
    save(`${label}__${String(take + 1).padStart(2, "0")}`, add(strum(DEMO_CHORD_VOICINGS[label], level, seed), room(seed)));
    count++;
  });
});
[40, 45, 50, 55, 59, 64].forEach((midi, i) => {
  save(`none-string__${String(i + 1).padStart(2, "0")}`, add(strum([midi], 0.15, 500 + i), room(500 + i)));
  count++;
});
[1, 2].forEach((take) => {
  save(`none-silence__0${take}`, room(900 + take));
  count++;
});
console.log(`Wrote ${count} synthetic recordings to ${OUT_DIR}/`);
