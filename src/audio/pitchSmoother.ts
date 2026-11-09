import type { PitchReading } from "./pitch.ts";

// How many recent detections the median looks at (~5 × 75 ms ≈ 0.4 s).
const MEDIAN_WINDOW = 5;
// How far the needle moves toward the new value each frame (0 … 1).
// Smaller = calmer but slower. 0.35 settles in about 5 frames.
const GLIDE = 0.35;
// A jump larger than this (in semitones) means a new note, not jitter.
const NEW_NOTE_JUMP = 0.7;
// How long the last note stays on screen after the sound becomes unclear.
export const HOLD_MS = 900;

// Work in semitones (MIDI scale) so low and high strings are treated equally.
const toSemitones = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);
const toFrequency = (semitones: number) => 440 * 2 ** ((semitones - 69) / 12);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Median of recent detections → glide toward it → hold the last note for HOLD_MS. */
export class PitchSmoother {
  private recent: number[] = []; // last detections, in semitones
  private shown: number | null = null; // what the display shows, in semitones
  private lastClarity = 0;
  private lastDetectedAt = -Infinity;

  push(reading: PitchReading, timeMs: number): PitchReading {
    if (reading.status === "detected") {
      return this.acceptDetection(reading.frequency, reading.clarity, timeMs);
    }
    return this.holdOrRelease(reading, timeMs);
  }

  private acceptDetection(
    frequency: number,
    clarity: number,
    timeMs: number,
  ): PitchReading {
    this.recent.push(toSemitones(frequency));
    if (this.recent.length > MEDIAN_WINDOW) this.recent.shift();
    const target = median(this.recent);

    if (this.shown === null || Math.abs(target - this.shown) > NEW_NOTE_JUMP) {
      // First note, or the player moved to another note: jump straight there.
      this.shown = target;
    } else {
      // Same note: glide toward it.
      this.shown += GLIDE * (target - this.shown);
    }

    this.lastClarity = clarity;
    this.lastDetectedAt = timeMs;
    return {
      status: "detected",
      frequency: toFrequency(this.shown),
      clarity,
      held: false,
    };
  }

  private holdOrRelease(reading: PitchReading, timeMs: number): PitchReading {
    const stillHolding =
      this.shown !== null && timeMs - this.lastDetectedAt < HOLD_MS;
    if (stillHolding && this.shown !== null) {
      return {
        status: "detected",
        frequency: toFrequency(this.shown),
        clarity: this.lastClarity,
        held: true,
      };
    }
    this.reset();
    return reading;
  }

  reset(): void {
    this.recent = [];
    this.shown = null;
    this.lastClarity = 0;
    this.lastDetectedAt = -Infinity;
  }
}
