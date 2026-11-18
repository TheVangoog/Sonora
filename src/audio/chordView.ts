import { CHORD_MESSAGES } from "./chords.ts";
import type { ChordReading } from "./chords.ts";
import type { ChordTemplate } from "./chordTemplates.ts";
import { frequencyToNote } from "./notes.ts";

// What the chord page shows. Three different answers are kept apart:
// a chord (sure, guessed or held), one note, or no chord at all.
export type ChordView =
  | { kind: "chord" | "guess" | "held"; chord: ChordTemplate; title: string; caption: string }
  | { kind: "note"; chord: null; title: string; caption: string }
  | { kind: "none"; chord: null; title: string; caption: string };

type ViewInput = {
  reading: ChordReading;
  shownChord: ChordTemplate | null;
  likelyChord: ChordTemplate | null;
  heldChord: ChordTemplate | null;
  singleNote: number | null;
};

// Priority: sure chord → one note → guessed chord → held (faded) chord → nothing.
export function chordViewOf(state: ViewInput): ChordView {
  const { shownChord, likelyChord, heldChord, singleNote, reading } = state;
  if (shownChord) {
    return { kind: "chord", chord: shownChord, title: shownChord.name, caption: shownChord.fullName };
  }
  const note = singleNote ? frequencyToNote(singleNote) : null;
  if (note) {
    const name = `${note.name}${note.octave}`;
    return { kind: "note", chord: null, title: name, caption: `One note (${name}), not a chord — strum more strings` };
  }
  if (likelyChord) {
    return {
      kind: "guess",
      chord: likelyChord,
      title: likelyChord.name,
      caption: `Probably: ${likelyChord.fullName} · not sure`,
    };
  }
  if (heldChord) {
    return { kind: "held", chord: heldChord, title: heldChord.name, caption: `Last chord: ${heldChord.fullName}` };
  }
  return { kind: "none", chord: null, title: "—", caption: CHORD_MESSAGES[reading.status] };
}
