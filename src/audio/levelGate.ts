// How far back we remember quiet levels to find the room's background (~8 s at 10 frames/s).
const WINDOW_FRAMES = 80;
// A frame must be this many dB louder than the room to START counting as playing.
export const MARGIN_DB = 12;
// Once the gate is open, it stays open down to this margin (hysteresis).
// A fading strum drops below room + 12 dB after ~1.5 s while it still rings.
// Checked with `npm run replay:live`.
export const CLOSE_MARGIN_DB = 6;
// For the first ~1 s we do not know the room yet, so the gate stays open.
const WARM_UP_FRAMES = 10;
// A quiet room is never louder than this. Without the ceiling, continuous
// playing in the warm-up second would be mistaken for the background.
const ROOM_CEILING_DBFS = -45;
// The background is learned only while the gate is closed, so a long quiet tone
// cannot slowly become "the room". The one exception: a level that stays open
// and almost constant for 30 s is a new background (a fan, a hum), not a guitar.
export const STEADY_FRAMES = 300;
const STEADY_SPREAD_DB = 3;

/**
 * Learns the room level (quietest recent frame while nobody plays) instead of a
 * fixed threshold, because rooms differ from −65 to −45 dBFS.
 * Hysteresis: opens at room + 12 dB, closes below room + 6 dB.
 */
export class LevelGate {
  private history: number[] = [];
  private openLevels: number[] = [];
  private open = false;
  private readonly openMarginDb: number;
  private readonly closeMarginDb: number;

  constructor(openMarginDb = MARGIN_DB, closeMarginDb = CLOSE_MARGIN_DB) {
    this.openMarginDb = openMarginDb;
    this.closeMarginDb = closeMarginDb;
  }

  /** Feeds this frame's level and says whether we hear playing (above the room). */
  isAboveRoom(dbfs: number): boolean {
    if (!Number.isFinite(dbfs)) {
      this.openLevels = [];
      return (this.open = false);
    }

    if (this.history.length < WARM_UP_FRAMES) {
      this.remember(dbfs);
      return (this.open = true);
    }

    const margin = this.open ? this.closeMarginDb : this.openMarginDb;
    this.open = dbfs >= this.roomLevel() + margin;

    if (!this.open) {
      this.openLevels = [];
      this.remember(dbfs);
    } else if (this.isSteadyForLong(dbfs)) {
      // The background changed: relearn it from the steady stretch.
      this.history = this.openLevels.slice(-WINDOW_FRAMES);
      this.openLevels = [];
      this.open = false;
    }
    return this.open;
  }

  /** The answer of the last isAboveRoom() call (the AI engine asks it every 0.5 s). */
  isOpen(): boolean {
    return this.open;
  }

  /** The background level of the room (dBFS): the quietest recent quiet frame, at most −45. */
  roomLevel(): number {
    return Math.min(ROOM_CEILING_DBFS, ...this.history);
  }

  isLearning(): boolean {
    return this.history.length < WARM_UP_FRAMES;
  }

  reset(): void {
    this.history = [];
    this.openLevels = [];
    this.open = false;
  }

  private remember(dbfs: number): void {
    this.history.push(dbfs);
    if (this.history.length > WINDOW_FRAMES) this.history.shift();
  }

  private isSteadyForLong(dbfs: number): boolean {
    this.openLevels.push(dbfs);
    if (this.openLevels.length > STEADY_FRAMES) this.openLevels.shift();
    if (this.openLevels.length < STEADY_FRAMES) return false;
    return Math.max(...this.openLevels) - Math.min(...this.openLevels) < STEADY_SPREAD_DB;
  }
}
