import { PitchDetector } from "pitchy";
import { measureSignal } from "./signal.ts";

export const MIN_PITCH_HZ = 60;
export const MAX_PITCH_HZ = 1500;
export const MIN_PITCH_DBFS = -55;
// A real guitar through a laptop microphone often reaches only 0.8–0.9.
export const MIN_CLARITY = 0.8;

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
  private detector: PitchDetector<Float32Array>;
  private centered: Float32Array;

  constructor(frameSize: number) {
    this.detector = PitchDetector.forFloat32Array(frameSize);
    this.centered = new Float32Array(frameSize);
  }

  analyze(samples: Float32Array, sampleRate: number): PitchReading {
    if (
      samples.length !== this.centered.length ||
      !samples.length ||
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0
    ) {
      return { status: "unclear", frequency: null, clarity: 0 };
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

    const [frequency, clarity] = this.detector.findPitch(
      this.centered,
      sampleRate,
    );
    const safeClarity = Number.isFinite(clarity)
      ? Math.max(0, Math.min(1, clarity))
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
