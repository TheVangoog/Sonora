export type Complex = { re: number; im: number };

const add = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

const subtract = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

const multiply = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

// Unit complex number e^(i·angle).
const turnBy = (angle: number): Complex => ({
  re: Math.cos(angle),
  im: Math.sin(angle),
});

export const isPowerOfTwo = (n: number) =>
  Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

/**
 * Recursive radix-2 Cooley–Tukey FFT of real samples (length must be a power of 2).
 * Allocates many small objects: fine for ~10 frames per second.
 */
export function fft(samples: ArrayLike<number>): Complex[] {
  if (!isPowerOfTwo(samples.length)) {
    throw new Error(
      `FFT needs a power-of-two length, got ${samples.length}.`,
    );
  }
  const values = Array.from(samples, (re): Complex => ({ re, im: 0 }));
  return transform(values);
}

function transform(values: Complex[]): Complex[] {
  const n = values.length;

  if (n === 1) return [values[0]];

  const even = values.filter((_, index) => index % 2 === 0);
  const odd = values.filter((_, index) => index % 2 === 1);

  const evenResult = transform(even);
  const oddResult = transform(odd);

  const result = new Array<Complex>(n);
  const half = n / 2;
  for (let k = 0; k < half; k++) {
    const turnedOdd = multiply(turnBy((-2 * Math.PI * k) / n), oddResult[k]);
    result[k] = add(evenResult[k], turnedOdd);
    result[k + half] = subtract(evenResult[k], turnedOdd);
  }
  return result;
}
