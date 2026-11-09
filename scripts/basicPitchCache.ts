// The Basic Pitch network's output for every window of a file, saved to disk.
// Used by scripts/tune-basic-pitch.ts and scripts/tune-chord-rules.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeWav } from "../src/audio/wav.ts";
import { MIN_CHORD_DBFS } from "../src/audio/chords.ts";
import { measureSignal } from "../src/audio/signal.ts";
import {
  BASIC_PITCH_SAMPLE_RATE,
  BASIC_PITCH_WINDOW,
  prepareRunner,
  runBasicPitch,
} from "../src/audio/engines/basicPitchEngine.ts";
import { loadBasicPitchModelFromDisk } from "./basicPitchModel.ts";

// Same windowing as scripts/evaluate.ts, so the numbers match its reports.
export const SKIP_SECONDS = 0.3;
export const MAX_WINDOWS_PER_FILE = 12;
// v2: our own runner (one pass per window). The old folder "basic-pitch"
// holds the output of the library's evaluateModel(), kept for comparison.
const CACHE_DIR = "tests/recordings/.cache/basic-pitch-v2";

// One window = its loudness (dBFS) and the network's note activity per frame.
// null frames = too quiet, the engine would not even ask the network.
export type CachedWindow = { dbfs: number; frames: number[][] | null };

let runner: ReturnType<typeof prepareRunner> | null = null;

/** Start positions of the windows, exactly as scripts/evaluate.ts cuts a take. */
export function windowStarts(length: number, window: number, sampleRate: number): number[] {
  const starts: number[] = [];
  for (
    let start = Math.round(SKIP_SECONDS * sampleRate);
    start + window <= length && starts.length < MAX_WINDOWS_PER_FILE;
    start += window
  ) {
    starts.push(start);
  }
  return starts;
}

export async function networkOutput(folder: string, file: string): Promise<CachedWindow[]> {
  const cacheFile = `${CACHE_DIR}/${folder.split("/").pop()}/${file}.json`;
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));

  const { samples, sampleRate } = decodeWav(readFileSync(`${folder}/${file}`).buffer as ArrayBuffer);
  const window = Math.round((BASIC_PITCH_WINDOW / BASIC_PITCH_SAMPLE_RATE) * sampleRate);
  const windows: CachedWindow[] = [];
  for (const start of windowStarts(samples.length, window, sampleRate)) {
    const piece = samples.slice(start, start + window);
    const dbfs = measureSignal(piece).dbfs;
    runner ??= prepareRunner(loadBasicPitchModelFromDisk);
    const frames = dbfs < MIN_CHORD_DBFS ? null : await runBasicPitch(await runner, piece, sampleRate);
    // Three decimals are plenty and keep the cache small.
    windows.push({ dbfs, frames: frames?.map((f) => f.map((v) => Math.round(v * 1000) / 1000)) ?? null });
  }
  mkdirSync(cacheFile.slice(0, cacheFile.lastIndexOf("/")), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(windows));
  return windows;
}
