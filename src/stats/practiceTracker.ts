import { IN_TUNE_CENTS } from "../audio/notes.ts";
import type { PracticePage, PracticeSession } from "./practice.ts";

// A note counts once it has been held this long (a passing note is not practice).
export const NOTE_HOLD_MS = 400;
// Shorter sessions are not reported (a quick look at the page).
export const MIN_SESSION_SECONDS = 5;
const LAST_READINGS = 10;

/**
 * Turns what the page shows into one PracticeSession: how long the microphone
 * was on, which notes were held and how close to the target they ended,
 * and how many chords appeared.
 */
export class PracticeTracker {
  private readonly page: PracticePage;
  private readonly startedAt: number;
  private note: { name: string; since: number; cents: number[] } | null = null;
  private notesHeard = 0;
  private notesInTune = 0;
  private sumAbsCents = 0;
  private lastChord: string | null = null;
  private chordsShown = 0;

  constructor(page: PracticePage, now: number) {
    this.page = page;
    this.startedAt = now;
  }

  /** Every new pitch reading: the nearest note name (null = nothing heard) and its cents. */
  hearNote(name: string | null, cents: number, now: number): void {
    if (this.note && this.note.name === name) {
      this.note.cents.push(cents);
      if (this.note.cents.length > LAST_READINGS) this.note.cents.shift();
      return;
    }
    this.closeNote(now);
    this.note = name ? { name, since: now, cents: [cents] } : null;
  }

  /** Every chord the page shows (null = none); a chord counts when it appears. */
  showChord(name: string | null): void {
    if (name && name !== this.lastChord) this.chordsShown++;
    this.lastChord = name;
  }

  finish(now: number, engine: "dsp" | "ai" | null): PracticeSession | null {
    this.closeNote(now);
    const seconds = (now - this.startedAt) / 1000;
    if (seconds < MIN_SESSION_SECONDS) return null;
    return {
      page: this.page,
      startedAt: this.startedAt,
      seconds: Math.round(seconds * 10) / 10,
      notesHeard: this.notesHeard,
      notesInTune: this.notesInTune,
      sumAbsCents: Math.round(this.sumAbsCents * 10) / 10,
      chordsShown: this.chordsShown,
      engine: this.page === "chords" ? engine : null,
    };
  }

  private closeNote(now: number): void {
    const note = this.note;
    this.note = null;
    if (!note || now - note.since < NOTE_HOLD_MS) return;
    // Where the note ended up: the median of its last readings.
    const sorted = [...note.cents].sort((a, b) => a - b);
    const cents = Math.min(50, Math.abs(sorted[Math.floor(sorted.length / 2)]));
    this.notesHeard++;
    this.sumAbsCents += cents;
    if (cents <= IN_TUNE_CENTS) this.notesInTune++;
  }
}
