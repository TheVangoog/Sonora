import { percentile } from "./latency.ts";

// A strum: the level jumps by at least this much from one analysis to the next.
export const ONSET_JUMP_DB = 6;
// A chord counts as settled once its name has stayed the same this long.
export const SETTLED_MS = 1000;
// A strum older than this no longer explains a change (e.g. the same chord again).
export const MAX_REACTION_MS = 5000;
const KEEP = 200;

export type Spread = { median: number; p95: number; count: number };
export type ChordTimingSummary = {
  modelLoadMs: number[]; // every AI load in this page visit
  firstResult: Spread; // first strum after the microphone starts → first chord on the screen
  reaction: Spread; // a strum → the shown chord changes
  settle: Spread; // a strum → the name then stays the same for SETTLED_MS
};

/**
 * Speed of the chord page, measured where it matters: from the strum (a jump
 * in the level the page hears) to what the screen shows. Times come from
 * performance.now(), the same clock as the analysis.
 */
export class ChordTiming {
  private lastDbfs = -Infinity;
  private onset: number | null = null; // the latest strum still waiting for a change
  private settleFrom: number | null = null; // the latest strum still waiting to settle
  private firstPending = false;
  private shown: string | null = null;
  private shownSince = 0;
  private readonly first: number[] = [];
  private readonly reactions: number[] = [];
  private readonly settles: number[] = [];
  private readonly loads: number[] = [];

  /** The microphone (re)started: the next strum is the first one. */
  start(): void {
    this.lastDbfs = -Infinity;
    this.onset = this.settleFrom = null;
    this.firstPending = true;
    this.shown = null;
  }

  /** The level of every analysed frame. */
  level(dbfs: number, playing: boolean, now: number): void {
    if (playing && dbfs - this.lastDbfs >= ONSET_JUMP_DB) {
      this.onset = now;
      this.settleFrom = now;
    }
    this.lastDbfs = dbfs;
  }

  /** The chord name on the screen after every analysis (null = none). */
  show(name: string | null, now: number): void {
    if (this.onset !== null && now - this.onset > MAX_REACTION_MS) this.onset = null;
    if (this.settleFrom !== null && now - this.settleFrom > MAX_REACTION_MS + SETTLED_MS) this.settleFrom = null;
    if (name !== this.shown) {
      if (name && this.onset !== null) {
        this.push(this.firstPending ? this.first : this.reactions, now - this.onset);
        this.firstPending = false;
        this.onset = null;
      }
      this.shown = name;
      this.shownSince = now;
    }
    // Settled: the name changed after the strum and then stayed for SETTLED_MS.
    // A strum that changes nothing (the same chord again) simply expires.
    const changedSinceStrum = this.settleFrom !== null && this.shownSince >= this.settleFrom;
    if (this.shown && changedSinceStrum && now - this.shownSince >= SETTLED_MS) {
      this.push(this.settles, this.shownSince - this.settleFrom!);
      this.settleFrom = null;
    }
  }

  modelLoaded(ms: number): void {
    this.push(this.loads, ms);
  }

  summary(): ChordTimingSummary {
    const spread = (values: number[]): Spread => ({
      median: percentile(values, 50),
      p95: percentile(values, 95),
      count: values.length,
    });
    return {
      modelLoadMs: [...this.loads],
      firstResult: spread(this.first),
      reaction: spread(this.reactions),
      settle: spread(this.settles),
    };
  }

  reset(): void {
    this.first.length = this.reactions.length = this.settles.length = this.loads.length = 0;
  }

  private push(list: number[], value: number): void {
    list.push(Math.round(value));
    if (list.length > KEEP) list.shift();
  }
}

/** One per page visit; also reachable from the console as __sonoraChordTiming. */
export const chordTiming = new ChordTiming();
(globalThis as Record<string, unknown>).__sonoraChordTiming = chordTiming;
