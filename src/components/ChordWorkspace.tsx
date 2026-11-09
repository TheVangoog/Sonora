import { useEffect, useState } from "react";
import AppIcon from "./AppIcon.jsx";
import SignalMonitor from "./SignalMonitor.tsx";
import AudioStatusBadge from "./AudioStatusBadge.tsx";
import AudioSourceControls from "./AudioSourceControls.tsx";
import ChordDisplay from "./ChordDisplay.tsx";
import { useAudioInput } from "../hooks/useAudioInput.ts";
import { useChordDetection } from "../hooks/useChordDetection.ts";
import { useAiEngine } from "../hooks/useAiEngine.ts";
import type { AiStatus } from "../hooks/useAiEngine.ts";
import { CHORD_FRAME_SIZE } from "../audio/chords.ts";
import {
  DEMO_CHORD_NAMES,
  demoChordFrequencies,
} from "../audio/demoChords.ts";

// The AI needs the last 2 s; keep 3 s.
const HISTORY_SECONDS = 3;

export default function ChordWorkspace() {
  const audio = useAudioInput(CHORD_FRAME_SIZE, HISTORY_SECONDS);
  const [useAi, setUseAi] = useState(false);
  const [allChords, setAllChords] = useState(true);
  const ai = useAiEngine(useAi);
  const chordState = useChordDetection(
    audio.status === "running",
    audio.readFrame,
    audio.readHistory,
    ai.engine,
    allChords ? "extended" : "basic",
  );

  const [demoChord, setDemoChord] = useState("Am");
  const [demoLevel, setDemoLevel] = useState(0.3);
  const { setDemoTones } = audio;

  useEffect(() => {
    setDemoTones(demoChordFrequencies(demoChord), demoLevel);
  }, [setDemoTones, demoChord, demoLevel]);

  return (
    <section className="audio-workspace" aria-label="Chord recognizer">
      <header className="workspace-header">
        <h2>
          <AppIcon name="chord" size={19} />
          Chord recognizer
        </h2>
        <AudioStatusBadge status={audio.status} mode={audio.mode} />
      </header>
      <div className="engine-row">
        <div className="instrument-switch" role="group" aria-label="Who recognizes the chord">
          <button
            aria-pressed={!useAi}
            className={!useAi ? "selected" : undefined}
            onClick={() => setUseAi(false)}
          >
            Algorithm
          </button>
          <button
            aria-pressed={useAi}
            className={useAi ? "selected" : undefined}
            onClick={() => setUseAi(true)}
          >
            AI
          </button>
        </div>
        <div className="instrument-switch" role="group" aria-label="Which chords to look for">
          <button
            aria-pressed={!allChords}
            className={!allChords ? "selected" : undefined}
            onClick={() => setAllChords(false)}
          >
            Major/minor
          </button>
          <button
            aria-pressed={allChords}
            className={allChords ? "selected" : undefined}
            onClick={() => setAllChords(true)}
          >
            All chords
          </button>
        </div>
        <p className="engine-note" role="status">
          {engineNote(useAi, ai.status, ai.error)}
        </p>
      </div>
      <div className="workspace-content">
        <ChordDisplay {...chordState} />
      </div>
      <SignalMonitor
        running={audio.status === "running"}
        sampleRate={audio.sampleRate}
        readFrame={audio.readFrame}
        frameSize={CHORD_FRAME_SIZE}
      />
      <AudioSourceControls
        status={audio.status}
        mode={audio.mode}
        error={audio.error}
        start={audio.start}
        stop={audio.stop}
        demoLabel="Test chord"
        demoSettings={
          <div className="demo-settings">
            <p>Silent generator · open guitar chords, string by string</p>
            <div
              className="demo-chords"
              role="group"
              aria-label="Test chord"
            >
              {DEMO_CHORD_NAMES.map((name) => (
                <button
                  key={name}
                  aria-pressed={demoChord === name}
                  className={demoChord === name ? "selected" : undefined}
                  onClick={() => setDemoChord(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <label>
              Volume <output>{demoLevel.toFixed(2)}</output>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={demoLevel}
                onChange={(event) => setDemoLevel(Number(event.target.value))}
              />
            </label>
          </div>
        }
      />
    </section>
  );
}

function engineNote(useAi: boolean, status: AiStatus, error: string | null) {
  if (!useAi) return "Our algorithm (FFT → chroma → templates): answers in ~0.2 s. It often names seventh chords (maj7, m7…) as a simpler chord — use AI for them.";
  if (status === "preparing") {
    return "AI is loading and warming up (up to ~15 s the first time). The algorithm runs meanwhile.";
  }
  if (status === "error") return `AI could not start: ${error}. The algorithm is running.`;
  return "AI (Basic Pitch neural network): listens to the last 2 s and answers twice per second. More accurate, but reacts with a ~1–2 s delay.";
}
