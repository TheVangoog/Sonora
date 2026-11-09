import type { ChordReading } from "./chords.ts";
import type { ChordTemplate } from "./chordTemplates.ts";

/**
 * A new chord must repeat `framesToConfirm` times; the shown chord is cleared
 * after `framesToRelease` frames without one. A shown chord is kept while it is
 * still the best guess above KEEP_SCORE, so a fading chord does not drop out.
 */
export const KEEP_SCORE = 0.6;

export class ChordStabilizer {
  private shown: ChordTemplate | null = null;
  private candidate: ChordTemplate | null = null;
  private candidateFrames = 0;
  private framesWithoutChord = 0;
  private readonly framesToConfirm: number;
  private readonly framesToRelease: number;

  constructor(framesToConfirm = 2, framesToRelease = 5) {
    this.framesToConfirm = framesToConfirm;
    this.framesToRelease = framesToRelease;
  }

  push(reading: ChordReading): ChordTemplate | null {
    // The shown chord is still the best guess, just less certain: keep it.
    const best = reading.candidates[0];
    const shownStillLeads =
      this.shown !== null &&
      best?.template.name === this.shown.name &&
      best.score >= KEEP_SCORE;
    if (reading.status !== "detected" && shownStillLeads) {
      this.framesWithoutChord = 0;
      return this.shown;
    }

    if (reading.status !== "detected") {
      this.candidate = null;
      this.candidateFrames = 0;
      this.framesWithoutChord++;
      if (this.framesWithoutChord >= this.framesToRelease) this.shown = null;
      return this.shown;
    }

    this.framesWithoutChord = 0;
    const chord = reading.chord;

    // The same chord we already show: nothing to decide.
    if (this.shown?.name === chord.name) {
      this.candidate = null;
      this.candidateFrames = 0;
      return this.shown;
    }

    // A different chord: count how many frames in a row it appears.
    if (this.candidate?.name === chord.name) {
      this.candidateFrames++;
    } else {
      this.candidate = chord;
      this.candidateFrames = 1;
    }
    if (this.candidateFrames >= this.framesToConfirm) {
      this.shown = chord;
      this.candidate = null;
      this.candidateFrames = 0;
    }
    return this.shown;
  }

  reset(): void {
    this.shown = null;
    this.candidate = null;
    this.candidateFrames = 0;
    this.framesWithoutChord = 0;
  }
}
