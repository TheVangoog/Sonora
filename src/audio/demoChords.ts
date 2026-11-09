// Each chord is listed string by string (low E → high E) as MIDI numbers;
// muted strings are left out. Example: Am = x02210 → A2 E3 A3 C4 E4.
export const DEMO_CHORD_VOICINGS: Record<string, number[]> = {
  C: [48, 52, 55, 60, 64], // x32010
  G: [43, 47, 50, 55, 59, 67], // 320003
  D: [50, 57, 62, 66], // xx0232
  A: [45, 52, 57, 61, 64], // x02220
  E: [40, 47, 52, 56, 59, 64], // 022100
  Am: [45, 52, 57, 60, 64], // x02210
  Em: [40, 47, 52, 55, 59, 64], // 022000
  Dm: [50, 57, 62, 65], // xx0231
  F: [41, 48, 53, 57, 60, 65], // 133211 (barre)
  // Seventh chords
  G7: [43, 47, 50, 55, 59, 65], // 320001
  E7: [40, 47, 50, 56, 59, 64], // 020100
  A7: [45, 52, 55, 61, 64], // x02020
  D7: [50, 57, 60, 66], // xx0212
  C7: [48, 52, 58, 60, 64], // x32310
  Am7: [45, 52, 55, 60, 64], // x02010
  Em7: [40, 47, 50, 55, 59, 64], // 020000
  Dm7: [50, 57, 60, 65], // xx0211
  Cmaj7: [48, 52, 55, 59, 64], // x32000
  Fmaj7: [53, 57, 60, 64], // xx3210
  // Diminished, half-diminished, augmented
  Bdim: [47, 53, 59, 62], // x2343x
  "Bm7♭5": [47, 53, 57, 62], // x2323x
  Caug: [48, 52, 56, 60, 64], // x32110
  // Power chords: root + fifth (+ octave)
  E5: [40, 47, 52], // 022xxx
  A5: [45, 52, 57], // x022xx
};

export const DEMO_CHORD_NAMES = Object.keys(DEMO_CHORD_VOICINGS);

export function midiToFrequency(midi: number, referenceA4 = 440): number {
  return referenceA4 * 2 ** ((midi - 69) / 12);
}

export function demoChordFrequencies(name: string): number[] {
  return (DEMO_CHORD_VOICINGS[name] ?? []).map((midi) => midiToFrequency(midi));
}
