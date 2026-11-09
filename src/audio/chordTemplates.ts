import { NOTE_NAMES } from "./notes.ts";

export type ChordQuality =
  | "major"
  | "minor"
  | "dominant7"
  | "major7"
  | "minor7"
  | "diminished"
  | "halfDiminished7"
  | "augmented"
  | "power";

export type ChordTemplate = {
  name: string; // "Am", "G7", "Bm7♭5", "E5"
  fullName: string; // "A minor", "G dominant seventh"
  root: number; // pitch class of the root: 0 = C … 11 = B
  quality: ChordQuality;
  tones: number[]; // pitch classes of the chord: Am → [9, 0, 4]
  // Tones that may be missing. Guitarists often leave the fifth out of a
  // seventh chord: the common C7 shape x32310 is C E B♭ C E, without G.
  optionalTones: number[];
};

// Intervals, shown for root C:
//   major      C  E  G        0 4 7       minor       C  E♭ G        0 3 7
//   7          C  E  G  B♭    0 4 7 10    maj7        C  E  G  B     0 4 7 11
//   m7         C  E♭ G  B♭    0 3 7 10    dim         C  E♭ G♭       0 3 6
//   m7♭5 (ø)   C  E♭ G♭ B♭    0 3 6 10    aug         C  E  G♯       0 4 8
//   5 (power)  C  G           0 7
const INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  diminished: [0, 3, 6],
  halfDiminished7: [0, 3, 6, 10],
  augmented: [0, 4, 8],
  power: [0, 7],
};

// In 7, maj7 and m7 the fifth (7 semitones) is optional. In m7♭5 the
// lowered fifth is what makes the chord, so there it is required.
const OPTIONAL_FIFTH = new Set<ChordQuality>(["dominant7", "major7", "minor7"]);

// The order also decides ties: when two templates fit equally well, the one
// listed first wins (so a plain triad beats a rarer chord with the same score).
const QUALITIES = Object.keys(INTERVALS) as ChordQuality[];

const NAME_SUFFIX: Record<ChordQuality, string> = {
  major: "",
  minor: "m",
  dominant7: "7",
  major7: "maj7",
  minor7: "m7",
  diminished: "dim",
  halfDiminished7: "m7♭5",
  augmented: "aug",
  power: "5",
};
const FULL_SUFFIX: Record<ChordQuality, string> = {
  major: "major",
  minor: "minor",
  dominant7: "dominant seventh",
  major7: "major seventh",
  minor7: "minor seventh",
  diminished: "diminished",
  halfDiminished7: "half-diminished seventh",
  augmented: "augmented",
  power: "power chord (fifth)",
};

function buildTemplate(root: number, quality: ChordQuality): ChordTemplate {
  return {
    name: NOTE_NAMES[root] + NAME_SUFFIX[quality],
    fullName: `${NOTE_NAMES[root]} ${FULL_SUFFIX[quality]}`,
    root,
    quality,
    tones: INTERVALS[quality].map((interval) => (root + interval) % 12),
    optionalTones: OPTIONAL_FIFTH.has(quality) ? [(root + 7) % 12] : [],
  };
}

// Quality first, then root: all majors, then all minors, … (see the tie note above).
export const CHORD_TEMPLATES: ChordTemplate[] = QUALITIES.flatMap((quality) =>
  NOTE_NAMES.map((_, root) => buildTemplate(root, quality)),
);

export function findTemplate(name: string): ChordTemplate | undefined {
  return CHORD_TEMPLATES.find((template) => template.name === name);
}

/** Same notes (e.g. Caug = Eaug): chroma cannot tell them apart, evaluation counts them as equal. */
export function sameNotes(a: string, b: string): boolean {
  if (a === b) return true;
  const first = findTemplate(a);
  const second = findTemplate(b);
  if (!first || !second || first.tones.length !== second.tones.length) return false;
  return first.tones.every((tone) => second.tones.includes(tone));
}
