import { measureSignal } from "./signal.ts";
import { Yin } from "./yin.ts";

export const MIN_PITCH_HZ = 60;
export const MAX_PITCH_HZ = 1500;
export const MIN_PITCH_DBFS = -55;
// The lowest guitar string (E2). The YIN window must hold two of its periods.
export const LOWEST_STRING_HZ = 82.4069;
// YIN absolute threshold on d'(τ); the paper uses 0.10–0.15.
export const YIN_THRESHOLD = 0.15;
// Clarity = 1 − d'(τ). A dip found only as the global minimum is still accepted
// down to this value, because a real guitar through a laptop microphone is not a clean sine.
export const MIN_CLARITY = 0.8;
// The tuner analyses one frame every 75 ms (~13 per second) on both frame paths.
export const ANALYSIS_HOP_MS = 75;

// Longest searched period (lowest frequency) in samples.
function maxLagFor(sampleRate: number): number {
  return Math.ceil(sampleRate / MIN_PITCH_HZ);
}

// Shortest searched period. Slightly above 1500 Hz, so a higher tone is
// reported as out of range instead of being mistaken for a lower one.
function minLagFor(sampleRate: number): number {
  return Math.max(2, Math.floor(sampleRate / (MAX_PITCH_HZ * 1.25)));
}

// Frame length for the tuner at this sample rate: the longest period plus an
// integration window of two E2 periods, rounded up to a power of two (AnalyserNode
// needs one). 44.1 and 48 kHz → 2048 samples, 96 kHz → 4096.
export function tunerFrameSize(sampleRate: number): number {
  const needed = maxLagFor(sampleRate) + Math.ceil((2 * sampleRate) / LOWEST_STRING_HZ);
  let size = 32;
  while (size < needed && size < 32768) size *= 2;
  return size;
}

// held = true: no fresh note in this frame; the smoother keeps showing the last
// one for a moment so the display does not blink (see pitchSmoother.ts).
export type PitchReading =
  | { status: "detected"; frequency: number; clarity: number; held?: boolean }
  | {
      status: "idle" | "quiet" | "unclear" | "out-of-range";
      frequency: null;
      clarity: number;
    };

export const IDLE_PITCH: PitchReading = {
  status: "idle",
  frequency: null,
  clarity: 0,
};
export const PITCH_MESSAGES = {
  idle: "Turn on the microphone or the test signal",
  quiet: "Too quiet — play one note",
  unclear: "Could not find a single tone — play a sustained note",
  "out-of-range": "Sound outside the 60–1500 Hz working range",
  detected: "Pitch detected",
};

export class ToneDetector {
  private yin = new Yin();
  private centered = new Float32Array(0);

  analyze(samples: Float32Array, sampleRate: number): PitchReading {
    if (
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0 ||
      samples.length < tunerFrameSize(sampleRate)
    ) {
      return { status: "unclear", frequency: null, clarity: 0 };
    }
    if (this.centered.length !== samples.length) {
      this.centered = new Float32Array(samples.length);
    }

    let mean = 0;
    for (const sample of samples) {
      if (!Number.isFinite(sample)) {
        return { status: "unclear", frequency: null, clarity: 0 };
      }
      mean += sample;
    }
    mean /= samples.length;
    for (let i = 0; i < samples.length; i++) {
      this.centered[i] = samples[i] - mean;
    }

    if (measureSignal(this.centered).dbfs < MIN_PITCH_DBFS) {
      return { status: "quiet", frequency: null, clarity: 0 };
    }

    const { period, aperiodicity } = this.yin.estimate(
      this.centered,
      minLagFor(sampleRate),
      maxLagFor(sampleRate),
      YIN_THRESHOLD,
    );
    const frequency = sampleRate / period;
    const safeClarity = Number.isFinite(aperiodicity)
      ? Math.max(0, Math.min(1, 1 - aperiodicity))
      : 0;

    if (
      !Number.isFinite(frequency) ||
      frequency <= 0 ||
      safeClarity < MIN_CLARITY
    ) {
      return { status: "unclear", frequency: null, clarity: safeClarity };
    }
    if (frequency < MIN_PITCH_HZ || frequency > MAX_PITCH_HZ) {
      return { status: "out-of-range", frequency: null, clarity: safeClarity };
    }
    return { status: "detected", frequency, clarity: safeClarity };
  }
}
