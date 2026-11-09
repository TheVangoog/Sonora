import { useEffect, useState } from "react";
import { IDLE_PITCH, ToneDetector } from "../audio/pitch.ts";
import type { PitchReading } from "../audio/pitch.ts";
import { PitchSmoother } from "../audio/pitchSmoother.ts";

type ReadFrame = () => { samples: Float32Array; sampleRate: number } | null;

export function usePitchDetection(
  running: boolean,
  readFrame: ReadFrame,
): PitchReading {
  const [pitch, setPitch] = useState<PitchReading>(IDLE_PITCH);

  useEffect(() => {
    setPitch(IDLE_PITCH);
    if (!running) return;
    let detector: ToneDetector | null = null;
    let frameSize = 0;
    const smoother = new PitchSmoother();
    let request = 0;
    let lastAnalysis = -Infinity;

    function update(time: number) {
      // About 13 measurements per second; the waveform drawing has its own loop.
      if (time - lastAnalysis >= 75) {
        const frame = readFrame();
        if (frame) {
          if (!detector || frameSize !== frame.samples.length) {
            frameSize = frame.samples.length;
            detector = new ToneDetector(frameSize);
          }
          const raw = detector.analyze(frame.samples, frame.sampleRate);
          setPitch(smoother.push(raw, time));
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
  }, [running, readFrame]);

  // Stop and pause clear the old note from the screen at once.
  return running ? pitch : IDLE_PITCH;
}
