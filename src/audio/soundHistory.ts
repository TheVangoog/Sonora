/**
 * Ring buffer of the latest sound. Needed because AnalyserNode gives at most
 * 32 768 samples (0.68 s at 48 kHz) and the AI needs 2 s.
 */
export class SoundHistory {
  private readonly buffer: Float32Array;
  private writeAt = 0; // where the next sample goes
  private written = 0; // how many samples we have received in total

  constructor(capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  /** Add a block of new samples (e.g. 1024 from the AudioWorklet). */
  push(block: Float32Array): void {
    for (const sample of block) {
      this.buffer[this.writeAt] = sample;
      this.writeAt = (this.writeAt + 1) % this.buffer.length;
    }
    this.written += block.length;
  }

  /** The newest `length` samples in time order, or null if we have not heard that much yet. */
  latest(length: number): Float32Array | null {
    if (length > this.buffer.length || length > this.written) return null;
    const result = new Float32Array(length);
    const start = (this.writeAt - length + this.buffer.length) % this.buffer.length;
    for (let i = 0; i < length; i++) {
      result[i] = this.buffer[(start + i) % this.buffer.length];
    }
    return result;
  }
}

// Collects 128-sample blocks into 1024 before posting (~47 messages/s instead of ~375).
export const HISTORY_WORKLET = `
class SonoraHistory extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(1024);
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;
    for (const sample of channel) {
      this.chunk[this.filled++] = sample;
      if (this.filled === this.chunk.length) {
        this.port.postMessage(this.chunk.slice(0));
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor("sonora-history", SonoraHistory);
`;
