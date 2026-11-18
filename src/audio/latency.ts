// Timing of the tuner's frame path, measured the same way for AnalyserNode and
// AudioWorklet (docs/results/latency-*.md):
//   wait     the newest sample of the frame → the frame is in main-thread JS
//            (AnalyserNode is read on the spot, so 0 by definition; AudioWorklet:
//            AudioContext time at arrival − time of the newest sample)
//   analyze  YIN + smoothing on the main thread
//   display  frame in JS → the next painted frame after React shows the result
//   total    wait + display (analyze is part of display)
//   interval time between two analysed frames (the real hop)

export type LatencySample = { waitMs: number; analyzeMs: number; displayMs: number };
export type Spread = { median: number; p95: number };
export type LatencySummary = {
  count: number;
  wait: Spread;
  analyze: Spread;
  display: Spread;
  total: Spread;
  interval: Spread;
};

const KEEP = 600; // the newest ~45 s at 13 frames/s

export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

const spread = (values: number[]): Spread => ({
  median: percentile(values, 50),
  p95: percentile(values, 95),
});

export class LatencyStats {
  private samples: LatencySample[] = [];
  private arrivals: number[] = [];

  /** A frame reached main-thread JS at `atMs` (performance.now()). */
  arrived(atMs: number): void {
    this.arrivals.push(atMs);
    if (this.arrivals.length > KEEP) this.arrivals.shift();
  }

  record(sample: LatencySample): void {
    this.samples.push(sample);
    if (this.samples.length > KEEP) this.samples.shift();
  }

  summary(): LatencySummary {
    const gaps = this.arrivals.slice(1).map((t, i) => t - this.arrivals[i]);
    return {
      count: this.samples.length,
      wait: spread(this.samples.map((s) => s.waitMs)),
      analyze: spread(this.samples.map((s) => s.analyzeMs)),
      display: spread(this.samples.map((s) => s.displayMs)),
      total: spread(this.samples.map((s) => s.waitMs + s.displayMs)),
      interval: spread(gaps),
    };
  }

  reset(): void {
    this.samples = [];
    this.arrivals = [];
  }
}
