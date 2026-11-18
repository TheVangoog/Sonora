import { useEffect, useRef, useState } from "react";
import { ANALYSIS_HOP_MS, IDLE_PITCH, ToneDetector } from "../audio/pitch.ts";
import type { PitchReading } from "../audio/pitch.ts";
import { PitchSmoother } from "../audio/pitchSmoother.ts";
import { LatencyStats } from "../audio/latency.ts";
import type { FrameSource, PushedFrame } from "../audio/AudioInput.ts";

type ReadFrame = () => { samples: Float32Array; sampleRate: number } | null;
type SubscribeFrames = (listener: (frame: PushedFrame) => void) => () => void;

// One LatencyStats per frame path, kept for the whole page visit so both paths
// can be compared; the measurement script reads them from window.
export const latencyStats: Record<FrameSource, LatencyStats> = {
  analyser: new LatencyStats(),
  worklet: new LatencyStats(),
};
(globalThis as Record<string, unknown>).__sonoraLatency = latencyStats;

type Pending = { source: FrameSource; arrivedAt: number; waitMs: number; analyzeMs: number };

// The same YIN detector and smoother on both paths; only the way frames
// arrive differs: "analyser" polls an AnalyserNode from requestAnimationFrame
// (at least ANALYSIS_HOP_MS apart), "worklet" gets frames pushed every hop.
export function usePitchDetection(
  running: boolean,
  readFrame: ReadFrame,
  source: FrameSource = "analyser",
  subscribeFrames?: SubscribeFrames,
): PitchReading {
  const [pitch, setPitch] = useState<PitchReading>(IDLE_PITCH);
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    setPitch(IDLE_PITCH);
    if (!running) return;
    const detector = new ToneDetector();
    const smoother = new PitchSmoother();
    const stats = latencyStats[source];

    function analyse(frame: { samples: Float32Array; sampleRate: number }, arrivedAt: number, waitMs: number) {
      stats.arrived(arrivedAt);
      const raw = detector.analyze(frame.samples, frame.sampleRate);
      const shown = smoother.push(raw, arrivedAt);
      pending.current = { source, arrivedAt, waitMs, analyzeMs: performance.now() - arrivedAt };
      setPitch(shown);
    }

    if (source === "worklet" && subscribeFrames) {
      return subscribeFrames((frame) => analyse(frame, frame.arrivedAt, frame.waitMs));
    }

    let request = 0;
    let lastAnalysis = -Infinity;
    function update(time: number) {
      if (time - lastAnalysis >= ANALYSIS_HOP_MS) {
        const frame = readFrame();
        if (frame) {
          // AnalyserNode is read right now: its newest sample is the newest rendered one.
          analyse(frame, performance.now(), 0);
        } else {
          smoother.reset();
          setPitch(IDLE_PITCH);
        }
        lastAnalysis = time;
      }
      request = requestAnimationFrame(update);
    }
    request = requestAnimationFrame(update);
    return () => cancelAnimationFrame(request);
  }, [running, readFrame, source, subscribeFrames]);

  // After React commits the reading: wait for the next painted frame and record.
  useEffect(() => {
    const frame = pending.current;
    if (!frame) return;
    pending.current = null;
    let timer = 0;
    const request = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        latencyStats[frame.source].record({
          waitMs: frame.waitMs,
          analyzeMs: frame.analyzeMs,
          displayMs: performance.now() - frame.arrivedAt,
        });
      });
    });
    return () => {
      cancelAnimationFrame(request);
      clearTimeout(timer);
    };
  }, [pitch]);

  // Stop and pause clear the old note from the screen at once.
  return running ? pitch : IDLE_PITCH;
}
