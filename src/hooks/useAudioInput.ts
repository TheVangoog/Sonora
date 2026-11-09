import { useCallback, useEffect, useRef, useState } from "react";
import { AudioInput, idleState } from "../audio/AudioInput.ts";
import type { AudioMode } from "../audio/AudioInput.ts";
import { FRAME_SIZE } from "../audio/signal.ts";

// frameSize: how many samples readFrame() returns. Tuner 2048, chords 8192.
// historySeconds: how many seconds of continuous sound to keep for the AI (0 = none).
export function useAudioInput(frameSize = FRAME_SIZE, historySeconds = 0) {
  const input = useRef<AudioInput | null>(null);
  const [state, setState] = useState(idleState);
  const [frequency, setFrequency] = useState(440);
  const [amplitude, setAmplitude] = useState(0.2);

  useEffect(() => {
    const engine = new AudioInput(setState, frameSize, historySeconds);
    input.current = engine;
    return () => {
      engine.dispose();
      input.current = null;
    };
  }, [frameSize, historySeconds]);

  useEffect(() => {
    input.current?.setDemo(frequency, amplitude);
  }, [frequency, amplitude]);

  const start = useCallback((mode: AudioMode) => {
    void input.current?.start(mode);
  }, []);
  const stop = useCallback(() => {
    input.current?.stop();
  }, []);
  const readFrame = useCallback(() => input.current?.readFrame() ?? null, []);
  // The last `seconds` of continuous sound (only if historySeconds > 0).
  const readHistory = useCallback(
    (seconds: number) => input.current?.readHistory(seconds) ?? null,
    [],
  );
  const setDemoTones = useCallback(
    (frequencies: number[], level: number) => {
      input.current?.setDemoTones(frequencies, level);
    },
    [],
  );

  return {
    ...state,
    frameSize,
    start,
    stop,
    readFrame,
    readHistory,
    frequency,
    setFrequency,
    amplitude,
    setAmplitude,
    setDemoTones,
  };
}
