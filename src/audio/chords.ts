import { measureSignal } from "./signal.ts";
import { magnitudeSpectrum } from "./spectrum.ts";
import { removeNoiseFloor } from "./noiseFloor.ts";
import { spectrumToChroma } from "./chroma.ts";
import type { Chroma } from "./chroma.ts";
import { rankChords } from "./chordMatcher.ts";
import type { ChordCandidate } from "./chordMatcher.ts";
import type { ChordTemplate } from "./chordTemplates.ts";

// 8192 samples ≈ 170 ms at 48 kHz. Shorter frames make bins too wide for the
// bass strings; longer frames make the display react too late.
export const CHORD_FRAME_SIZE = 8192;

// Quieter frames are treated as silence. A laptop microphone often hears a
// normal strum at −40 … −50 dBFS; noiseFloor.ts keeps quiet frames from
// turning into noise-chords.
export const MIN_CHORD_DBFS = -58;

// How similar the chroma must be to the best template (0 … 1).
// Measured on guitar-like signals with room noise (tests/chords.test.ts):
// 0.8 missed most quiet chords, 0.7 started to give wrong ones; 0.75 is between.
export const MIN_CHORD_SCORE = 0.75;

// Every tone of the chord must reach at least this share of the strongest
// pitch class. This stops a single note (whose harmonics also light up the
// fifth) from being reported as a chord.
export const MIN_TONE_LEVEL = 0.3;

// Rules for non-standard chords (7, maj7, m7, m7♭5, dim, aug, 5).
// Major/minor is the default answer; any other chord must beat it by a margin,
// because harmonics fake extra notes (a plain G looks like Gmaj7: the 3rd
// harmonic of B is F♯). Margins are tuned on GuitarSet:
// docs/results/tune-chord-rules-*.md.
export type ChordRules = {
  minScore: number; // how similar to the best template (0 … 1)
  minToneLevel: number; // every required tone must reach this share of the strongest
  vocabulary: "basic" | "extended"; // basic = 24 major/minor chords only
  extendedMargin: number; // 7, maj7, m7, m7♭5, dim, aug must beat major/minor by this
  powerMargin: number; // power chords (root + fifth) must beat major/minor by this
  // When a non-standard chord's lead is too small, fall back to the major/minor
  // chord "always", or only "ifHeard" (all its required tones are present).
  // Which works better depends on the engine; it is tuned like the margins.
  fallback: "always" | "ifHeard";
};

// Rules of the FFT pipeline. Each engine has its own, tuned separately.
export const DEFAULT_RULES: ChordRules = {
  minScore: MIN_CHORD_SCORE,
  minToneLevel: MIN_TONE_LEVEL,
  vocabulary: "extended",
  // Tuned with `npm run tune:chord-rules` (433/762 vs 399/762 major/minor only).
  extendedMargin: 0.08,
  powerMargin: 0.15,
  fallback: "always",
};

// How many alternative chords we keep for the display.
const CANDIDATES_TO_KEEP = 3;

export type ChordReading =
  | {
      status: "detected";
      chord: ChordTemplate;
      confidence: number;
      chroma: Chroma;
      candidates: ChordCandidate[];
      dbfs: number; // loudness of the frame
    }
  | {
      status: "idle" | "quiet" | "unclear";
      chord: null;
      confidence: number;
      chroma: Chroma | null;
      candidates: ChordCandidate[];
      dbfs: number; // loudness of the frame (−Infinity when unknown)
    };

// A result without any analysis yet (no sound, too quiet or invalid input).
export function emptyReading(
  status: "idle" | "quiet" | "unclear",
  dbfs = -Infinity,
): ChordReading {
  return { status, chord: null, confidence: 0, chroma: null, candidates: [], dbfs };
}

/** Treat a frame as silence (used by the room-level gate in the hook). */
export function asQuiet(reading: ChordReading): ChordReading {
  return emptyReading("quiet", reading.dbfs);
}

export const IDLE_CHORD = emptyReading("idle");

/** Turns an unclear reading into its best candidate. Silence and invalid input stay as they are. */
export function asBestGuess(reading: ChordReading): ChordReading {
  const best = reading.candidates[0];
  if (reading.status !== "unclear" || !best || !reading.chroma) return reading;
  return {
    status: "detected",
    chord: best.template,
    confidence: best.score,
    chroma: reading.chroma,
    candidates: reading.candidates,
    dbfs: reading.dbfs,
  };
}

export const CHORD_MESSAGES = {
  idle: "Turn on the microphone or the test chord",
  quiet: "Too quiet — strum the strings",
  unclear: "Does not match any known chord",
  detected: "Chord detected",
};

export class ChordDetector {
  private centered: Float32Array;
  private rules: Partial<ChordRules>;

  // rules: e.g. { vocabulary: "basic" } for major/minor only.
  constructor(frameSize: number, rules: Partial<ChordRules> = {}) {
    this.centered = new Float32Array(frameSize);
    this.rules = rules;
  }

  analyze(samples: Float32Array, sampleRate: number): ChordReading {
    if (
      samples.length !== this.centered.length ||
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0 ||
      !samples.every(Number.isFinite)
    ) {
      return emptyReading("unclear");
    }

    // Remove the DC offset without touching `samples`.
    let mean = 0;
    for (const sample of samples) mean += sample;
    mean /= samples.length;
    for (let i = 0; i < samples.length; i++) {
      this.centered[i] = samples[i] - mean;
    }

    const dbfs = measureSignal(this.centered).dbfs;
    if (dbfs < MIN_CHORD_DBFS) {
      return emptyReading("quiet", dbfs);
    }

    const spectrum = removeNoiseFloor(
      magnitudeSpectrum(this.centered, sampleRate),
    );
    const chroma = spectrumToChroma(spectrum);
    return classifyChroma(chroma, dbfs, this.rules);
  }
}

/** The chord decision shared by all engines (FFT and Basic Pitch). */
export function classifyChroma(
  chroma: Chroma,
  dbfs: number,
  rules: Partial<ChordRules> = {},
): ChordReading {
  const { minScore, minToneLevel, vocabulary, extendedMargin, powerMargin, fallback } = {
    ...DEFAULT_RULES,
    ...rules,
  };
  const isBasic = (c: ChordCandidate) =>
    c.template.quality === "major" || c.template.quality === "minor";
  const ranked = rankChords(chroma).filter((c) => vocabulary === "extended" || isBasic(c));

  // Is every tone that must sound (all except an optional fifth) clearly present?
  const heard = (c: ChordCandidate) =>
    c.template.tones
      .filter((tone) => !c.template.optionalTones.includes(tone))
      .every((tone) => chroma[tone] >= minToneLevel);

  // A non-standard chord wins only with a clear lead over the best major/minor.
  // With fallback "ifHeard" we fall back only to a major/minor that is heard in
  // full (C7 played without G then stays C7 instead of a C missing its G).
  let best = ranked[0];
  const bestBasic = ranked.find(isBasic);
  if (bestBasic && !isBasic(best) && (fallback === "always" || heard(bestBasic))) {
    const margin = best.template.quality === "power" ? powerMargin : extendedMargin;
    if (best.score - bestBasic.score < margin) best = bestBasic;
  }
  const candidates = [best, ...ranked.filter((c) => c !== best)].slice(0, CANDIDATES_TO_KEEP);

  // Accept the best chord only if it is convincing.
  const allTonesHeard = heard(best);
  if (best.score < minScore || !allTonesHeard) {
    return {
      status: "unclear",
      chord: null,
      confidence: best.score,
      chroma,
      candidates,
      dbfs,
    };
  }
  return {
    status: "detected",
    chord: best.template,
    confidence: best.score,
    chroma,
    candidates,
    dbfs,
  };
}
