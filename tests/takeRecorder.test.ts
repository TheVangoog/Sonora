import { test } from "node:test";
import assert from "node:assert/strict";
import { openTakeRecorder, RecordingCancelled, wait } from "../src/audio/takeRecorder.ts";
import type { RecorderDeps } from "../src/audio/takeRecorder.ts";

// Fakes for the browser parts: a stream whose tracks remember stop(), and an
// AudioContext with just what the recorder touches.
function fakeStream() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
}

function fakeContext() {
  const node = () => ({ gain: { value: 1 }, connect: (next: unknown) => next });
  const context = {
    state: "suspended",
    sampleRate: 48000,
    closed: 0,
    destination: {},
    audioWorklet: { addModule: async () => {} },
    createMediaStreamSource: node,
    createGain: node,
    resume: async () => { context.state = "running"; },
    close: async () => { context.closed++; context.state = "closed"; },
  };
  return context;
}

class FakeWorkletNode {
  port: { onmessage: ((event: { data: Float32Array }) => void) | null } = { onmessage: null };
  static last: FakeWorkletNode | null = null;
  constructor() { FakeWorkletNode.last = this; }
  connect(next: unknown) { return next; }
}
(globalThis as Record<string, unknown>).AudioWorkletNode = FakeWorkletNode;

test("a stream granted after Cancel is stopped at once (no microphone in the background)", async () => {
  const { stream, tracks } = fakeStream();
  let grant: (s: MediaStream) => void = () => {};
  let contexts = 0;
  const deps: RecorderDeps = {
    getUserMedia: () => new Promise((resolve) => (grant = resolve)),
    createContext: () => { contexts++; return fakeContext() as unknown as AudioContext; },
  };
  const controller = new AbortController();
  const opening = openTakeRecorder(controller.signal, deps);
  controller.abort(); // the user left the page while the permission prompt was open
  grant(stream);
  await assert.rejects(opening, RecordingCancelled);
  assert.equal(tracks[0].stopped, true);
  assert.equal(contexts, 0, "no AudioContext is created for a cancelled take");
});

test("the microphone is ready before the countdown, and only the take is kept", async () => {
  const { stream, tracks } = fakeStream();
  const context = fakeContext();
  const recorder = await openTakeRecorder(undefined, {
    getUserMedia: async () => stream,
    createContext: () => context as unknown as AudioContext,
  });
  assert.equal(context.state, "running", "graph is running before the countdown");
  const port = FakeWorkletNode.last!.port;
  port.onmessage!({ data: new Float32Array(128).fill(9) }); // sound during the countdown: ignored
  const taking = recorder.record(0.05);
  port.onmessage!({ data: new Float32Array(128).fill(1) });
  const take = await taking;
  assert.equal(take.samples.length, 128);
  assert.equal(take.samples[0], 1);
  recorder.close();
  assert.equal(tracks[0].stopped, true);
  assert.equal(context.closed, 1);
});

test("aborting during the take releases the microphone and the context", async () => {
  const { stream, tracks } = fakeStream();
  const context = fakeContext();
  const controller = new AbortController();
  const recorder = await openTakeRecorder(controller.signal, {
    getUserMedia: async () => stream,
    createContext: () => context as unknown as AudioContext,
  });
  const taking = recorder.record(10, controller.signal);
  controller.abort(); // unmount or Cancel
  await assert.rejects(taking, RecordingCancelled);
  assert.equal(tracks[0].stopped, true);
  assert.equal(context.closed, 1);
});

test("the countdown pause ends early on abort", async () => {
  const controller = new AbortController();
  const started = Date.now();
  const pause = wait(5000, controller.signal);
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pause, RecordingCancelled);
  assert.ok(Date.now() - started < 1000);
});
