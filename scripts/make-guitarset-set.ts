// Turns the public GuitarSet dataset into a test set for the evaluation stand:
// one short WAV file per chord, named like our own recordings ("Am__….wav").
//
// GuitarSet: Q. Xi, R. Bittner, J. Pauwels, X. Ye, J. P. Bello,
// "GuitarSet: A Dataset for Guitar Transcription", ISMIR 2018.
// Version 1.1.0, CC BY 4.0, https://zenodo.org/records/3371780
//
// Before running, unpack into tests/recordings/guitarset/:
//   annotation.zip      → annotation/*.jams
//   audio_mono-mic.zip  → audio/*_mic.wav
//
// Run: npm run make:guitarset      Then: npm run eval:guitarset
//      npm run make:guitarset-ext  Then: npm run eval:guitarset-ext
//      (--extended: also seventh, dim / m7♭5 / aug and power chords)
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { decodeWav, encodeWav } from "../src/audio/wav.ts";
import { harteToChord, harteToTriad } from "./guitarsetLabels.ts";

// ---------- Settings ----------
const RAW_DIR = "tests/recordings/guitarset";
// The original set (major/minor only) stays as it is, so old results remain comparable.
const EXTENDED = process.argv.includes("--extended");
const OUT_DIR = EXTENDED ? "tests/recordings/guitarset-segments-ext" : "tests/recordings/guitarset-segments";
const toChord = EXTENDED ? harteToChord : harteToTriad;
// Basic Pitch needs one 2 s window after the stand skips the first 0.3 s,
// so shorter chords cannot be judged by both engines and are left out.
const MIN_SECONDS = 2.3;
// Long chords are cut to 3 s: the same length as a take on the /#/record page.
const MAX_SECONDS = 3;

// ---------- What a GuitarSet annotation file looks like (only what we use) ----------
type ChordSegment = { time: number; duration: number; value: string };
type Jams = { annotations: { namespace: string; data: ChordSegment[] }[] };

// ---------- One recording → several chord files ----------
// Annotations: [0] = lead sheet, [1] = actually played. The original set keeps a
// chord only if both reduce to the same triad; the extended set uses [1] only.
const skipped = { short: 0, noTriad: 0, disagree: 0 };

function cutRecording(title: string): number {
  const jams: Jams = JSON.parse(readFileSync(`${RAW_DIR}/annotation/${title}.jams`, "utf8"));
  const [sheet, played] = jams.annotations.filter((a) => a.namespace === "chord");
  const { samples, sampleRate } = decodeWav(readFileSync(`${RAW_DIR}/audio/${title}_mic.wav`).buffer as ArrayBuffer);

  let written = 0;
  (EXTENDED ? played : sheet).data.forEach((segment, index) => {
    if (segment.duration < MIN_SECONDS) return void skipped.short++;
    const chord = toChord(segment.value);
    if (!chord) return void skipped.noTriad++;
    if (!EXTENDED) {
      // The played chord that starts and ends at the same moment.
      const match = played.data.find(
        (p) => Math.abs(p.time - segment.time) < 0.05 && Math.abs(p.duration - segment.duration) < 0.05,
      );
      if (!match || toChord(match.value) !== chord) return void skipped.disagree++;
    }

    const start = Math.round(segment.time * sampleRate);
    const end = Math.min(samples.length, start + Math.round(Math.min(segment.duration, MAX_SECONDS) * sampleRate));
    const number = String(index).padStart(2, "0");
    // "D♯__00_BN1-129-Eb_comp_02.wav": the label before "__" is what the stand expects.
    writeFileSync(`${OUT_DIR}/${chord}__${title}_${number}.wav`, Buffer.from(encodeWav(samples.slice(start, end), sampleRate)));
    written++;
  });
  return written;
}

// ---------- Main ----------
rmSync(OUT_DIR, { recursive: true, force: true }); // start clean every time
mkdirSync(OUT_DIR, { recursive: true });

const titles = readdirSync(`${RAW_DIR}/annotation`)
  .filter((file) => file.endsWith("_comp.jams")) // accompaniment only: solos are single notes
  .map((file) => file.replace(".jams", ""))
  .sort();

let total = 0;
for (const title of titles) {
  total += cutRecording(title);
  process.stdout.write(`\r${title}`.padEnd(40));
}

// How many files per chord, so the balance of the set is visible.
const perChord = new Map<string, number>();
for (const file of readdirSync(OUT_DIR)) {
  const chord = file.split("__")[0];
  perChord.set(chord, (perChord.get(chord) ?? 0) + 1);
}
console.log(`\n${total} chord files from ${titles.length} recordings → ${OUT_DIR}`);
console.log(
  `Skipped: ${skipped.short} shorter than ${MIN_SECONDS} s, ${skipped.noTriad} without a chord Sonora knows, ` +
    `${skipped.disagree} where the played chord differs from the sheet.`,
);
console.log([...perChord.entries()].sort().map(([chord, n]) => `${chord}: ${n}`).join(", "));
