// The label is the start of the file name: "Am__03.wav" is take 3 of Am.
// Labels starting with "none-" are recordings where NO chord should be found.
export const CHORD_LABELS = ["C", "G", "D", "A", "E", "Am", "Em", "Dm", "F"];

export const NO_CHORD_LABELS = [
  { label: "none-string", description: "one string" },
  { label: "none-silence", description: "room silence" },
  { label: "none-speech", description: "speech / noise" },
];

/** "Am__03.wav" → "Am"; "none-silence__01.wav" → "none-silence". */
export function labelFromFileName(fileName: string): string {
  return fileName.replace(/\\/g, "/").split("/").pop()!.split("__")[0];
}

/** The chord a recording should produce, or null for "no chord". */
export function expectedChord(label: string): string | null {
  return label.startsWith("none-") ? null : label;
}
