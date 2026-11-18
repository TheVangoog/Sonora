/**
 * Ring buffer inside the AudioWorklet: collects the 128-sample blocks and says
 * when a new frame is due (every `hopSize` samples, once `frameSize` are heard).
 * The worklet runs this very class (FRAME_WORKLET below embeds its source),
 * so the tests check the code the browser runs. No class fields on purpose:
 * the source must stay plain JavaScript after the TypeScript is stripped.
 */
export class FrameRing {
  buffer: Float32Array;
  hopSize: number;
  writeAt: number;
  heard: number;
  sinceFrame: number;

  constructor(frameSize: number, hopSize: number) {
    this.buffer = new Float32Array(frameSize);
    this.hopSize = hopSize;
    this.writeAt = 0;
    this.heard = 0;
    this.sinceFrame = 0;
  }

  /** Adds a block; true when a new frame should be sent now. */
  push(block: Float32Array): boolean {
    const size = this.buffer.length;
    for (let i = 0; i < block.length; i++) {
      this.buffer[this.writeAt] = block[i];
      this.writeAt = (this.writeAt + 1) % size;
    }
    this.heard += block.length;
    this.sinceFrame += block.length;
    if (this.heard < size || this.sinceFrame < this.hopSize) return false;
    this.sinceFrame %= this.hopSize; // keep the cadence, also right after the first frame
    return true;
  }

  /** The newest frameSize samples in time order. */
  copyLatest(out: Float32Array): void {
    const size = this.buffer.length;
    for (let i = 0; i < size; i++) out[i] = this.buffer[(this.writeAt + i) % size];
  }
}

// Posts {samples, endTime} to the main thread: the same frames as AnalyserNode
// gives (frameSize samples), but pushed every hop instead of polled. endTime is
// the AudioContext time just after the newest sample.
export const FRAME_WORKLET = `
const FrameRing = ${FrameRing.toString()};
class SonoraFrames extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { frameSize, hopSize } = options.processorOptions;
    this.ring = new FrameRing(frameSize, hopSize);
    this.frameSize = frameSize;
  }
  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;
    if (this.ring.push(channel)) {
      const samples = new Float32Array(this.frameSize);
      this.ring.copyLatest(samples);
      const endTime = currentTime + channel.length / sampleRate;
      this.port.postMessage({ samples, endTime }, [samples.buffer]);
    }
    return true;
  }
}
registerProcessor("sonora-frames", SonoraFrames);
`;
