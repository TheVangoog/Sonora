export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
// Spoken names, for captions and screen readers.
export const SPOKEN_NAMES = [
  "C",
  "C sharp",
  "D",
  "D sharp",
  "E",
  "F",
  "F sharp",
  "G",
  "G sharp",
  "A",
  "A sharp",
  "B",
];
export const IN_TUNE_CENTS = 5;

export function frequencyToNote(frequency: number, referenceA4 = 440) {
  if (
    !Number.isFinite(frequency) ||
    frequency <= 0 ||
    !Number.isFinite(referenceA4) ||
    referenceA4 <= 0
  )
    return null;

  const midi = Math.round(69 + 12 * Math.log2(frequency / referenceA4));
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  const targetFrequency = referenceA4 * 2 ** ((midi - 69) / 12);

  const cents = 1200 * Math.log2(frequency / targetFrequency);
  if (
    !Number.isFinite(cents) ||
    !Number.isFinite(targetFrequency) ||
    targetFrequency <= 0
  )
    return null;

  return {
    midi,
    pitchClass,
    octave,
    name: NOTE_NAMES[pitchClass],
    spokenName: SPOKEN_NAMES[pitchClass],
    label: `${NOTE_NAMES[pitchClass]}${octave}`,
    targetFrequency,
    cents,
    direction:
      Math.abs(cents) <= IN_TUNE_CENTS
        ? ("in-tune" as const)
        : cents < 0
          ? ("flat" as const)
          : ("sharp" as const),
  };
}
