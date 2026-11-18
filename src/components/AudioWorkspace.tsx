import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AppIcon from "./AppIcon.jsx";
import SignalMonitor from "./SignalMonitor.tsx";
import AudioStatusBadge from "./AudioStatusBadge.tsx";
import AudioSourceControls from "./AudioSourceControls.tsx";
import { useAudioInput } from "../hooks/useAudioInput.ts";
import { latencyStats, usePitchDetection } from "../hooks/usePitchDetection.ts";
import { useSettings } from "../settings/SettingsContext.tsx";
import type { FrameSource } from "../audio/AudioInput.ts";
import type { LatencySummary } from "../audio/latency.ts";
import { tunerFrameSize } from "../audio/pitch.ts";
import type { PitchReading } from "../audio/pitch.ts";
import { frequencyToNote } from "../audio/notes.ts";
import { usePracticeTracking } from "../stats/usePracticeTracking.ts";

// Workspace for a single tone (tuner and note finder).
type Props = {
  title: string;
  practicePage: "tuner" | "notes";
  icon?: string;
  children: (pitch: PitchReading) => ReactNode;
};

export default function AudioWorkspace({
  title,
  practicePage,
  icon = "tune",
  children,
}: Props) {
  const [settings, updateSettings] = useSettings();
  const source = settings.analysisPath;
  const audio = useAudioInput(tunerFrameSize, 0, source);
  const pitch = usePitchDetection(
    audio.status === "running",
    audio.readFrame,
    source,
    audio.subscribeFrames,
  );

  // Practice statistics (only when signed in, only from the microphone).
  const practice = usePracticeTracking(practicePage, audio.status === "running" && audio.mode === "microphone");
  useEffect(() => {
    const note = pitch.status === "detected" ? frequencyToNote(pitch.frequency, settings.referenceHz) : null;
    practice.hearNote(note ? note.name + note.octave : null, note?.cents ?? 0);
  }, [pitch, practice, settings.referenceHz]);

  return (
    <section className="audio-workspace" aria-label={title}>
      <header className="workspace-header">
        <h2>
          <AppIcon name={icon} size={19} />
          {title}
        </h2>
        <AudioStatusBadge status={audio.status} mode={audio.mode} />
      </header>
      <div className="workspace-content">{children(pitch)}</div>
      <p className="pitch-quality">
        Pitch clarity:{" "}
        {pitch.status === "idle" ? "—" : pitch.clarity.toFixed(2)} / 1 ·
        one note at a time
      </p>
      <div className="engine-row">
        <div className="instrument-switch" role="group" aria-label="How frames reach the analysis">
          {FRAME_PATHS.map(({ id, label }) => (
            <button
              key={id}
              aria-pressed={source === id}
              className={source === id ? "selected" : undefined}
              onClick={() => updateSettings({ analysisPath: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <LatencyLine source={source} running={audio.status === "running"} />
      </div>
      <SignalMonitor
        running={audio.status === "running"}
        sampleRate={audio.sampleRate}
        readFrame={audio.readFrame}
        frameSize={audio.sampleRate ? tunerFrameSize(audio.sampleRate) : undefined}
      />
      <AudioSourceControls
        status={audio.status}
        mode={audio.mode}
        error={audio.error}
        start={audio.start}
        stop={audio.stop}
        demoSettings={
          <div className="demo-settings">
            <p>Silent sine wave · generator settings</p>
            <label>
              Frequency <output>{audio.frequency} Hz</output>
              <input
                type="range"
                min="100"
                max="1000"
                step="1"
                value={audio.frequency}
                onChange={(event) =>
                  audio.setFrequency(Number(event.target.value))
                }
              />
            </label>
            <label>
              Amplitude <output>{audio.amplitude.toFixed(2)}</output>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={audio.amplitude}
                onChange={(event) =>
                  audio.setAmplitude(Number(event.target.value))
                }
              />
            </label>
          </div>
        }
      />
    </section>
  );
}

const FRAME_PATHS: { id: FrameSource; label: string }[] = [
  { id: "analyser", label: "AnalyserNode" },
  { id: "worklet", label: "AudioWorklet" },
];

// Refreshed once per second, so the measurement does not slow down the display it measures.
function LatencyLine({ source, running }: { source: FrameSource; running: boolean }) {
  const [summary, setSummary] = useState<LatencySummary | null>(null);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSummary(latencyStats[source].summary()), 1000);
    return () => clearInterval(timer);
  }, [source, running]);
  const ms = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "—");
  return (
    <p className="engine-note" role="status">
      {summary && summary.count > 0
        ? `Frame → screen: median ${ms(summary.total.median)} ms, p95 ${ms(summary.total.p95)} ms · YIN ${ms(summary.analyze.median)} ms · every ${ms(summary.interval.median)} ms (n = ${summary.count})`
        : "Frame → screen latency appears after the first second of sound."}
    </p>
  );
}
