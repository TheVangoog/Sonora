import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { AudioInput } from "../src/audio/AudioInput.ts";
import type { InputState } from "../src/audio/AudioInput.ts";

// The mocks check the resource lifecycle, not real browser compatibility.
class FakeNode {
  gain = { value: 1, setTargetAtTime() {} };
  frequency = { value: 440, setTargetAtTime() {} };
  fftSize = 0;
  stopped = false;
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start() {}
  stop() {
    this.stopped = true;
  }
  getFloatTimeDomainData(buffer: Float32Array) {
    buffer.fill(0.2);
  }
}
class FakeContext {
  static instances: FakeContext[] = [];
  state = "suspended";
  sampleRate = 48000;
  currentTime = 0;
  destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  nodes: FakeNode[] = [];
  constructor() {
    FakeContext.instances.push(this);
  }
  node() {
    const node = new FakeNode();
    this.nodes.push(node);
    return node;
  }
  createAnalyser() {
    return this.node();
  }
  createGain() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createMediaStreamSource() {
    return this.node();
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}
function stream() {
  const track = {
    readyState: "live",
    stopped: false,
    onended: null as (() => void) | null,
    stop() {
      this.stopped = true;
      this.readyState = "ended";
    },
  };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}
function setup(t: TestContext, getUserMedia = async () => stream()) {
  FakeContext.instances = [];
  for (const [key, value] of Object.entries({
    AudioContext: FakeContext,
    navigator: { mediaDevices: { getUserMedia } },
    isSecureContext: true,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const states: InputState[] = [];
  const input = new AudioInput((state) => states.push(state));
  t.after(() => input.dispose());
  return { input, states };
}

test("microphone Stop releases tracks, graph and AudioContext", async (t) => {
  const media = stream();
  const { input, states } = setup(t, async () => media);
  await input.start("microphone");
  assert.equal(states.at(-1)?.status, "running");
  assert.equal(input.readFrame()?.samples.length, 2048);
  input.stop();
  assert.equal(media.track.stopped, true);
  assert.equal(FakeContext.instances[0].state, "closed");
  assert.ok(FakeContext.instances[0].nodes.every((node) => node.disconnected));
  assert.equal(input.readFrame(), null);
});

test("late permission after cancellation immediately releases the received track", async (t) => {
  let grant!: (value: ReturnType<typeof stream>) => void;
  const pending = new Promise<ReturnType<typeof stream>>((resolve) => {
    grant = resolve;
  });
  const { input, states } = setup(t, () => pending);
  const starting = input.start("microphone");
  await Promise.resolve();
  input.stop();
  const media = stream();
  grant(media);
  await starting;
  assert.equal(media.track.stopped, true);
  assert.equal(states.at(-1)?.status, "idle");
  assert.equal(input.readFrame(), null);
});

test("old microphone rejection cannot overwrite a newer demo session", async (t) => {
  let reject!: (reason: Error) => void;
  const pending = new Promise<ReturnType<typeof stream>>((_, fail) => {
    reject = fail;
  });
  const { input, states } = setup(t, () => pending);
  const oldStart = input.start("microphone");
  await Promise.resolve();
  await input.start("demo");
  reject(new DOMException("Denied", "NotAllowedError"));
  await oldStart;
  assert.equal(states.at(-1)?.status, "running");
  assert.equal(states.at(-1)?.mode, "demo");
  assert.equal(FakeContext.instances[0].state, "closed");
});

test("denied permission shows an error and closes the context", async (t) => {
  const { input, states } = setup(t, async () => {
    throw new DOMException("Denied", "NotAllowedError");
  });
  await input.start("microphone");
  assert.equal(states.at(-1)?.status, "error");
  assert.match(states.at(-1)?.error ?? "", /Microphone access/);
  assert.equal(FakeContext.instances[0].state, "closed");
});

test("unmount/dispose silences updates and stops a late microphone grant", async (t) => {
  let grant!: (value: ReturnType<typeof stream>) => void;
  const pending = new Promise<ReturnType<typeof stream>>((resolve) => {
    grant = resolve;
  });
  const { input, states } = setup(t, () => pending);
  const starting = input.start("microphone");
  await Promise.resolve();
  input.dispose();
  const count = states.length;
  const media = stream();
  grant(media);
  await starting;
  assert.equal(media.track.stopped, true);
  assert.equal(states.length, count);
});

test("device disconnection cleans up and reports why input ended", async (t) => {
  const media = stream();
  const { input, states } = setup(t, async () => media);
  await input.start("microphone");
  media.track.onended?.();
  assert.equal(states.at(-1)?.status, "error");
  assert.equal(FakeContext.instances[0].state, "closed");
  assert.equal(input.readFrame(), null);
});

test("suspension pauses readings and recovery restores the running state", async (t) => {
  const { input, states } = setup(t);
  await input.start("demo");
  const context = FakeContext.instances[0];
  context.state = "suspended";
  context.onstatechange?.();
  assert.equal(states.at(-1)?.status, "paused");
  assert.equal(input.readFrame(), null);
  context.state = "running";
  context.onstatechange?.();
  assert.equal(states.at(-1)?.status, "running");
  input.stop();
  assert.ok(context.nodes.some((node) => node.stopped));
});

test("frame size is configurable for the chord recognizer", async (t) => {
  FakeContext.instances = [];
  for (const [key, value] of Object.entries({ AudioContext: FakeContext, isSecureContext: true })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const input = new AudioInput(() => {}, 8192);
  t.after(() => input.dispose());
  await input.start("demo");
  assert.equal(input.readFrame()?.samples.length, 8192);
});

test("a demo chord runs one oscillator per tone and Stop releases all of them", async (t) => {
  const { input } = setup(t);
  input.setDemoTones([110, 165, 220], 0.3);
  await input.start("demo");
  const context = FakeContext.instances[0];
  const oscillatorCount = () => context.nodes.filter((node) => node.frequency.value !== 440).length;
  assert.equal(oscillatorCount(), 3);
  // Switching to a 4-tone chord replaces the oscillators.
  input.setDemoTones([147, 220, 294, 370], 0.3);
  assert.equal(context.nodes.filter((node) => node.stopped).length, 3);
  input.stop();
  assert.ok(context.nodes.every((node) => node.disconnected));
});
