/** Linear interpolation with a moving-average pre-filter against aliasing when downsampling. */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return samples.slice();

  const ratio = fromRate / toRate;
  const source = ratio > 1 ? smooth(samples, Math.round(ratio)) : samples;
  // Multiply first, then divide: 48000 × 22050 / 48000 is exactly 22050,
  // while 48000 / (48000 / 22050) ends up at 22049.999… because of rounding.
  const length = Math.floor((samples.length * toRate) / fromRate);
  const result = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, source.length - 1);
    const fraction = position - left;
    result[i] = source[left] * (1 - fraction) + source[right] * fraction;
  }
  return result;
}

// Moving average over `width` samples.
function smooth(samples: Float32Array, width: number): Float32Array {
  if (width <= 1) return samples;
  const result = new Float32Array(samples.length);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
    if (i >= width) sum -= samples[i - width];
    result[i] = sum / Math.min(i + 1, width);
  }
  return result;
}

/** Cut or pad with silence so the array has exactly `length` samples. */
export function fitLength(samples: Float32Array, length: number): Float32Array {
  const result = new Float32Array(length);
  result.set(samples.subarray(0, length));
  return result;
}
