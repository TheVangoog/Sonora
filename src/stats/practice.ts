// One practice session as the client reports it and the server stores it.
// Shared by both sides, like parseSettings. No audio, only counts.

export const PRACTICE_PAGES = ["tuner", "notes", "chords"] as const;
export type PracticePage = (typeof PRACTICE_PAGES)[number];

export type PracticeSession = {
  page: PracticePage;
  startedAt: number; // ms since 1970
  seconds: number; // how long the microphone was on
  notesHeard: number; // tuner/notes: displayed notes (one per stable note)
  notesInTune: number; // of them within ±5 cents
  sumAbsCents: number; // for the mean |cents|
  chordsShown: number; // chords page: chords that appeared on the screen
  engine: "dsp" | "ai" | null; // chords page: which recognizer
};

const MAX_SECONDS = 6 * 3600;

/** A valid session or null; the server stores nothing else. */
export function parsePracticeSession(raw: unknown, now = Date.now()): PracticeSession | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const count = (key: string) => {
    const n = v[key] ?? 0;
    return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
  };
  const page = PRACTICE_PAGES.find((p) => p === v.page);
  const seconds = typeof v.seconds === "number" && v.seconds > 0 && v.seconds <= MAX_SECONDS ? v.seconds : null;
  const startedAt =
    typeof v.startedAt === "number" && v.startedAt > now - 365 * 86_400_000 && v.startedAt <= now + 60_000
      ? v.startedAt
      : null;
  const notesHeard = count("notesHeard");
  const notesInTune = count("notesInTune");
  const chordsShown = count("chordsShown");
  const sumAbsCents =
    typeof (v.sumAbsCents ?? 0) === "number" && Number(v.sumAbsCents ?? 0) >= 0 ? Number(v.sumAbsCents ?? 0) : null;
  const engine = v.engine === "dsp" || v.engine === "ai" ? v.engine : v.engine == null ? null : undefined;
  if (
    !page || seconds === null || startedAt === null || notesHeard === null || notesInTune === null ||
    chordsShown === null || sumAbsCents === null || engine === undefined || notesInTune > notesHeard ||
    sumAbsCents > notesHeard * 50
  ) {
    return null;
  }
  return { page, startedAt, seconds, notesHeard, notesInTune, sumAbsCents, chordsShown, engine };
}

export type PracticeSummary = {
  days: number;
  sessions: number;
  minutes: Record<PracticePage, number>;
  minutesPerDay: { day: string; minutes: number }[]; // oldest first, "YYYY-MM-DD" (UTC)
  notesHeard: number;
  inTuneShare: number | null; // 0 … 1
  meanAbsCents: number | null;
  chordsShown: { dsp: number; ai: number };
};
