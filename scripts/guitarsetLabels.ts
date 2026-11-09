// GuitarSet chord labels (Harte notation, e.g. "A:min7", "G#:maj6(*5)/1", "E:(1,5)", "N")
// → Sonora chord names.
import { NOTE_NAMES } from "../src/audio/notes.ts";

const MAJOR_TYPES = new Set(["maj", "maj6", "maj7", "maj9", "6", "7", "9", "11", "13"]);
const MINOR_TYPES = new Set(["min", "min6", "min7", "min9", "min11", "minmaj7"]);

const LETTER_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function rootPitchClass(root: string): number | null {
  const letter = LETTER_PITCH[root[0]];
  if (letter === undefined) return null;
  let pitch = letter;
  for (const accidental of root.slice(1)) {
    if (accidental === "#") pitch++;
    else if (accidental === "b") pitch--;
    else return null;
  }
  return (pitch + 12) % 12;
}

/** "A:min7" → "Am", "D#:maj7/1" → "D♯", "E:(1,5)" → null. */
export function harteToTriad(label: string): string | null {
  if (label === "N" || label === "X") return null;

  // "D#:maj6(*5)/1" → root "D#", rest "maj6(*5)/1". A bare root ("C") means major.
  const [root, rest = "maj"] = label.split(":");
  const pitch = rootPitchClass(root);
  if (pitch === null) return null;

  const type = rest.split(/[(/]/)[0]; // "maj6"
  const changes = (rest.match(/\(([^)]*)\)/)?.[1] ?? "").split(","); // ["*5"]
  // Without the third, major and minor cannot be told apart.
  if (changes.includes("*3") || changes.includes("*b3")) return null;

  if (MAJOR_TYPES.has(type)) return NOTE_NAMES[pitch];
  if (MINOR_TYPES.has(type)) return NOTE_NAMES[pitch] + "m";
  return null; // dim, hdim7, aug, sus2, sus4, power chords ("(1,5)") …
}

// Like harteToTriad, but keeps 7 / maj7 / m7 / dim / m7♭5 / aug / 5 (G9 → G7, Am9 → Am7).
// null for sus2/sus4 (no third), 6/m6 (same notes as m7) and dim7 (no audible root).
const EXTENDED_TYPES: Record<string, string> = {
  maj: "", min: "m", minmaj7: "m",
  "7": "7", "9": "7", "11": "7", "13": "7",
  maj7: "maj7", maj9: "maj7",
  min7: "m7", min9: "m7", min11: "m7",
  dim: "dim", hdim7: "m7♭5", aug: "aug",
};

/** "G:9" → "G7", "B:hdim7/1" → "Bm7♭5", "E:(1,5)/1" → "E5", "D:sus4" → null. */
export function harteToChord(label: string): string | null {
  if (label === "N" || label === "X") return null;
  const [root, rest = "maj"] = label.split(":");
  const pitch = rootPitchClass(root);
  if (pitch === null) return null;

  // A bare list of intervals: only "(1,5)" (root + fifth) is a chord we know.
  if (rest.startsWith("(")) {
    const intervals = rest.slice(1, rest.indexOf(")")).split(",").sort().join(",");
    return intervals === "1,5" ? NOTE_NAMES[pitch] + "5" : null;
  }
  const type = rest.split(/[(/]/)[0];
  const changes = (rest.match(/\(([^)]*)\)/)?.[1] ?? "").split(",");
  if (changes.includes("*3") || changes.includes("*b3")) return null;

  const suffix = EXTENDED_TYPES[type];
  return suffix === undefined ? null : NOTE_NAMES[pitch] + suffix;
}
