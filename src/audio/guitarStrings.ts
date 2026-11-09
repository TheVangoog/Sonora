export type GuitarString = {
  number: number; // 6 = thickest (low E) … 1 = thinnest (high E)
  label: string; // "B₃"
  name: string; // "B"
  midi: number;
};

export const GUITAR_STRINGS: GuitarString[] = [
  { number: 6, label: "E₂", name: "E", midi: 40 },
  { number: 5, label: "A₂", name: "A", midi: 45 },
  { number: 4, label: "D₃", name: "D", midi: 50 },
  { number: 3, label: "G₃", name: "G", midi: 55 },
  { number: 2, label: "B₃", name: "B", midi: 59 },
  { number: 1, label: "E₄", name: "E", midi: 64 },
];

export function stringFrequency(string: GuitarString, referenceA4 = 440) {
  return referenceA4 * 2 ** ((string.midi - 69) / 12);
}

const centsBetween = (frequency: number, target: number) =>
  1200 * Math.log2(frequency / target);

// Guitar mode compares with a STRING, not the nearest note: a B string tuned
// a tone down must read "B, −200 cents", not "A, in tune".
export type StringTarget = {
  string: GuitarString;
  targetFrequency: number;
  cents: number; // negative = too low (tighten), positive = too high (loosen)
};

/** Automatic mode: the string whose pitch is closest to what we hear. */
export function nearestString(
  frequency: number,
  referenceA4 = 440,
): StringTarget {
  let best: StringTarget | null = null;
  for (const string of GUITAR_STRINGS) {
    const targetFrequency = stringFrequency(string, referenceA4);
    const cents = centsBetween(frequency, targetFrequency);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) {
      best = { string, targetFrequency, cents };
    }
  }
  return best!;
}

/** Manual mode: measure against the chosen string; octave errors (±1200 cents) are folded back. */
export function targetForString(
  frequency: number,
  string: GuitarString,
  referenceA4 = 440,
): StringTarget {
  const targetFrequency = stringFrequency(string, referenceA4);
  let cents = centsBetween(frequency, targetFrequency);
  while (cents > 900) cents -= 1200;
  while (cents < -900) cents += 1200;
  return { string, targetFrequency, cents };
}
