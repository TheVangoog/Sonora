import { useEffect, useState } from "react";
import { ChordDetector, emptyReading, IDLE_CHORD } from "../audio/chords.ts";
import type { ChordReading, ChordRules } from "../audio/chords.ts";
import type { ChordTemplate } from "../audio/chordTemplates.ts";
import type { ChordEngine } from "../audio/engines/chordEngine.ts";
import { AI_LIVE, DSP_LIVE, LiveChordTracker } from "../audio/liveChordTracker.ts";
import { measureSignal } from "../audio/signal.ts";

type ReadSound = { samples: Float32Array; sampleRate: number } | null;
type ReadFrame = () => ReadSound;
type ReadHistory = (seconds: number) => ReadSound;

const ANALYSIS_INTERVAL_MS = 100;
// Neighbouring 2-second windows barely differ, so twice per second is enough.
const AI_INTERVAL_MS = 500;

export type ChordState = {
  reading: ChordReading; // raw result of the latest analysis
  shownChord: ChordTemplate | null; // confident, stable chord
  likelyChord: ChordTemplate | null; // the most likely chord, even without confidence
  heldChord: ChordTemplate | null; // the sound faded: the last chord for a few more seconds (faded)
  roomDbfs: number | null; // the room's background level; null while still learning
  analysisMs: number | null; // how long the latest AI analysis took (null for the algorithm)
};

const IDLE_STATE: ChordState = {
  reading: IDLE_CHORD,
  shownChord: null,
  likelyChord: null,
  heldChord: null,
  roomDbfs: null,
  analysisMs: null,
};

// Timing and React state only; what to show is decided by LiveChordTracker.
// aiEngine = null → algorithm; otherwise → AI on the last 2 s of sound.
// vocabulary: "basic" = only the 24 major and minor chords; "extended" = all 108.
export function useChordDetection(
  running: boolean,
  readFrame: ReadFrame,
  readHistory: ReadHistory,
  aiEngine: ChordEngine | null,
  vocabulary: ChordRules["vocabulary"] = "extended",
): ChordState {
  const [state, setState] = useState<ChordState>(IDLE_STATE);

  useEffect(() => {
    setState(IDLE_STATE);
    if (!running) return;

    let detector: ChordDetector | null = null;
    let frameSize = 0;
    const tracker = new LiveChordTracker(aiEngine ? AI_LIVE : DSP_LIVE);
    let request = 0;
    let lastAnalysis = -Infinity;
    let lastAiAnalysis = -Infinity;
    let aiBusy = false; // the AI is still busy with the previous window: do not start a new one
    let cancelled = false; // the effect was cleaned up: ignore a late AI answer

    function publish(analysed: ChordReading, playing: boolean, analysisMs: number | null) {
      setState({ ...tracker.update(analysed, playing, performance.now()), analysisMs });
    }

    function analyzeWithDsp(frame: NonNullable<ReadSound>) {
      if (!detector || frameSize !== frame.samples.length) {
        frameSize = frame.samples.length;
        detector = new ChordDetector(frameSize, { vocabulary });
      }
      const analysed = detector.analyze(frame.samples, frame.sampleRate);
      publish(analysed, tracker.hear(analysed.dbfs), null);
    }

    // Runs the network only while the level gate is open.
    async function analyzeWithAi(engine: ChordEngine, sampleRate: number) {
      const seconds = engine.windowSamples(sampleRate) / sampleRate;
      const sound = readHistory(seconds);
      if (!sound) return; // not 2 s of sound yet
      if (!tracker.gate.isOpen()) {
        publish(emptyReading("quiet", measureSignal(sound.samples).dbfs), false, null);
        return;
      }
      aiBusy = true;
      try {
        const started = performance.now();
        const analysed = await engine.analyze(sound.samples, sound.sampleRate, { vocabulary });
        if (!cancelled) publish(analysed, true, performance.now() - started);
      } finally {
        aiBusy = false;
      }
    }

    function update(time: number) {
      if (time - lastAnalysis >= ANALYSIS_INTERVAL_MS) {
        const frame = readFrame();
        if (!frame) {
          setState(IDLE_STATE);
        } else if (!aiEngine) {
          analyzeWithDsp(frame);
        } else {
          // In AI mode the short frames only teach the room's silence gate.
          tracker.hear(measureSignal(frame.samples).dbfs);
          if (!aiBusy && time - lastAiAnalysis >= AI_INTERVAL_MS) {
            lastAiAnalysis = time;
            void analyzeWithAi(aiEngine, frame.sampleRate);
          }
        }
        lastAnalysis = time;
      }
      request = requestAnimationFrame(update);
    }
    request = requestAnimationFrame(update);
    return () => {
      cancelled = true;
      cancelAnimationFrame(request);
    };
  }, [running, readFrame, readHistory, aiEngine, vocabulary]);

  // Stop and pause clear the old chord from the screen at once.
  return running ? state : IDLE_STATE;
}
