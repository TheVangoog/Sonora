import { asBestGuess, asQuiet } from "./chords.ts";
import type { ChordReading } from "./chords.ts";
import { ChordStabilizer } from "./chordStabilizer.ts";
import type { ChordTemplate } from "./chordTemplates.ts";
import { LevelGate } from "./levelGate.ts";

export type LiveSettings = {
  framesToConfirm: number; // a new chord must repeat this many readings in a row
  framesToRelease: number; // readings without a chord before it is cleared
  holdMs: number; // after that the last chord stays (faded) this long; 0 = off
  openMarginDb?: number; // level gate: start of playing (see levelGate.ts)
  closeMarginDb?: number; // level gate: end of playing
};

// The algorithm answers ~10 times per second, so it needs a stricter filter.
export const DSP_LIVE: LiveSettings = { framesToConfirm: 2, framesToRelease: 5, holdMs: 4000 };
// The AI already averages 2 s of sound and answers twice per second.
export const AI_LIVE: LiveSettings = { framesToConfirm: 1, framesToRelease: 2, holdMs: 4000 };

export type LiveChordView = {
  reading: ChordReading; // the raw result of the latest analysis
  shownChord: ChordTemplate | null; // confident and stable
  likelyChord: ChordTemplate | null; // the most likely chord, even without confidence
  heldChord: ChordTemplate | null; // the sound has stopped: the last chord, kept for a while
  roomDbfs: number | null; // the room's background level; null while still learning
};

/**
 * What the chord page shows over time: level gate, two stabilizers and a
 * last-chord hold. Shared by useChordDetection and scripts/replay-live.ts,
 * so the replay measures exactly what the user sees.
 */
export class LiveChordTracker {
  readonly gate: LevelGate;
  private readonly stabilizer: ChordStabilizer;
  private readonly guessStabilizer: ChordStabilizer;
  private readonly holdMs: number;
  private lastChord: ChordTemplate | null = null;
  private lastChordAt = -Infinity;

  constructor(settings: LiveSettings) {
    this.gate = new LevelGate(settings.openMarginDb, settings.closeMarginDb);
    this.stabilizer = new ChordStabilizer(settings.framesToConfirm, settings.framesToRelease);
    // The second stabilizer accepts the best candidate even without confidence.
    this.guessStabilizer = new ChordStabilizer(settings.framesToConfirm, settings.framesToRelease);
    this.holdMs = settings.holdMs;
  }

  /** Feed the level of a short frame (~10 times per second). True = someone is playing. */
  hear(dbfs: number): boolean {
    return this.gate.isAboveRoom(dbfs);
  }

  /** Feed one analysis. `playing` = the gate's answer for this moment. */
  update(analysed: ChordReading, playing: boolean, nowMs: number): LiveChordView {
    const reading = playing ? analysed : asQuiet(analysed);
    const shownChord = this.stabilizer.push(reading);
    const likelyChord = this.guessStabilizer.push(asBestGuess(reading));

    const current = shownChord ?? likelyChord;
    if (current) {
      this.lastChord = current;
      this.lastChordAt = nowMs;
    }
    const holding = !current && nowMs - this.lastChordAt <= this.holdMs;
    return {
      reading,
      shownChord,
      likelyChord,
      heldChord: holding ? this.lastChord : null,
      roomDbfs: this.gate.isLearning() ? null : this.gate.roomLevel(),
    };
  }
}
