import type { DecodedAudio } from "./wav.ts";

// An AudioWorklet (not AnalyserNode) so that no samples are lost between reads.
const CAPTURE_WORKLET = `
class SonoraCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("sonora-capture", SonoraCapture);
`;

// Same microphone settings as the tuner: no echo cancellation, no noise
// suppression, no automatic gain — the dataset must contain the real sound.
const MICROPHONE: MediaStreamConstraints = {
  video: false,
  audio: {
    channelCount: { ideal: 1 },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
};

export type RecorderDeps = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createContext: () => AudioContext;
};

const browserDeps = (): RecorderDeps => ({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createContext: () => new AudioContext(),
});

export class RecordingCancelled extends Error {
  constructor() {
    super("Recording cancelled.");
    this.name = "RecordingCancelled";
  }
}

/** The microphone is open and the graph is ready; nothing is kept until record(). */
export type TakeRecorder = {
  sampleRate: number;
  record(seconds: number, signal?: AbortSignal): Promise<DecodedAudio>;
  close(): void;
};

/**
 * Asks for the microphone and prepares the AudioContext before the countdown,
 * so the take starts exactly when the countdown ends. When `signal` is aborted
 * while the permission prompt is still open, the stream that arrives later is
 * stopped at once (no microphone left running in the background).
 */
export async function openTakeRecorder(
  signal?: AbortSignal,
  deps: RecorderDeps = browserDeps(),
): Promise<TakeRecorder> {
  throwIfAborted(signal);
  const stream = await deps.getUserMedia(MICROPHONE);
  const stopStream = () => stream.getTracks().forEach((track) => track.stop());
  if (signal?.aborted) {
    stopStream();
    throw new RecordingCancelled();
  }

  const context = deps.createContext();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener("abort", close);
    stopStream();
    if (context.state !== "closed") void context.close().catch(() => {});
  };
  signal?.addEventListener("abort", close);

  try {
    const workletUrl = URL.createObjectURL(
      new Blob([CAPTURE_WORKLET], { type: "text/javascript" }),
    );
    try {
      await context.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }
    throwIfAborted(signal);

    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "sonora-capture");
    // A worklet only runs while connected to the output; the gain of 0 keeps it silent.
    const silent = context.createGain();
    silent.gain.value = 0;
    let blocks: Float32Array[] | null = null; // null = not recording yet
    capture.port.onmessage = (event) => blocks?.push(event.data);
    source.connect(capture).connect(silent).connect(context.destination);
    await context.resume();
    throwIfAborted(signal);

    return {
      sampleRate: context.sampleRate,
      async record(seconds, takeSignal) {
        blocks = [];
        await wait(seconds * 1000, takeSignal);
        const take = { samples: joinBlocks(blocks), sampleRate: context.sampleRate };
        blocks = null;
        return take;
      },
      close,
    };
  } catch (error) {
    close();
    throw signal?.aborted ? new RecordingCancelled() : error;
  }
}

/** A pause that ends early with RecordingCancelled when `signal` is aborted. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new RecordingCancelled());
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RecordingCancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RecordingCancelled();
}

function joinBlocks(blocks: Float32Array[]): Float32Array {
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const joined = new Float32Array(total);
  let offset = 0;
  for (const block of blocks) {
    joined.set(block, offset);
    offset += block.length;
  }
  return joined;
}
