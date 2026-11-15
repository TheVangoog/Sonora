// YIN pitch estimator: A. de Cheveigné, H. Kawahara, "YIN, a fundamental
// frequency estimator for speech and music", JASA 111(4), 2002 (steps 1–5).

export type YinEstimate = {
  /** Period in samples (fractional after interpolation); NaN when nothing was found. */
  period: number;
  /** Normalized difference d'(τ) at the chosen dip: 0 = perfectly periodic, ~1 = noise. */
  aperiodicity: number;
};

export class Yin {
  private difference = new Float32Array(0);
  private normalized = new Float32Array(0);

  /**
   * samples: the frame; it must be longer than maxLag.
   * minLag / maxLag: the searched periods in samples (= sampleRate / highest and lowest frequency).
   * threshold: the first dip of d'(τ) below this wins, which avoids octave-too-low errors.
   */
  estimate(
    samples: Float32Array,
    minLag: number,
    maxLag: number,
    threshold: number,
  ): YinEstimate {
    const window = samples.length - maxLag;
    if (minLag < 1 || maxLag <= minLag || window < 1) {
      return { period: NaN, aperiodicity: 1 };
    }
    if (this.difference.length !== maxLag + 1) {
      this.difference = new Float32Array(maxLag + 1);
      this.normalized = new Float32Array(maxLag + 1);
    }
    const d = this.difference;
    const dn = this.normalized;

    // Step 2: difference function d(τ) over a fixed integration window.
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        const delta = samples[j] - samples[j + lag];
        sum += delta * delta;
      }
      d[lag] = sum;
    }

    // Step 3: cumulative mean normalized difference d'(τ).
    dn[0] = 1;
    let runningSum = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      runningSum += d[lag];
      dn[lag] = runningSum > 0 ? (d[lag] * lag) / runningSum : 1;
    }

    // Step 4: absolute threshold, then slide down to the bottom of that dip.
    // Without a dip under the threshold, the global minimum is used.
    let lag = -1;
    for (let candidate = minLag; candidate <= maxLag; candidate++) {
      if (dn[candidate] < threshold) {
        lag = candidate;
        while (lag + 1 <= maxLag && dn[lag + 1] < dn[lag]) lag++;
        break;
      }
    }
    if (lag < 0) {
      lag = minLag;
      for (let candidate = minLag + 1; candidate <= maxLag; candidate++) {
        if (dn[candidate] < dn[lag]) lag = candidate;
      }
    }
    // A minimum on the edge of the range is not a real dip: the period lies outside.
    if (lag <= minLag || lag >= maxLag) {
      return { period: NaN, aperiodicity: dn[lag] };
    }

    // Step 5: parabolic interpolation. The paper fits the raw d(τ), because the
    // normalization in d'(τ) slightly shifts the minimum.
    const before = d[lag - 1];
    const at = d[lag];
    const after = d[lag + 1];
    const curvature = before - 2 * at + after;
    const shift = curvature > 0 ? (0.5 * (before - after)) / curvature : 0;

    return { period: lag + shift, aperiodicity: dn[lag] };
  }
}
