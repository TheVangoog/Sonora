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
export async function recordTake(seconds: number): Promise<DecodedAudio> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      channelCount: { ideal: 1 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const context = new AudioContext();
  const workletUrl = URL.createObjectURL(
    new Blob([CAPTURE_WORKLET], { type: "text/javascript" }),
  );

  try {
    await context.audioWorklet.addModule(workletUrl);
    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "sonora-capture");
    // A worklet only runs while connected to the output; the gain of 0 keeps it silent.
    const silent = context.createGain();
    silent.gain.value = 0;

    const blocks: Float32Array[] = [];
    capture.port.onmessage = (event) => blocks.push(event.data);
    source.connect(capture).connect(silent).connect(context.destination);
    await context.resume();

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    source.disconnect();
    capture.disconnect();

    return { samples: joinBlocks(blocks), sampleRate: context.sampleRate };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(workletUrl);
    void context.close();
  }
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
