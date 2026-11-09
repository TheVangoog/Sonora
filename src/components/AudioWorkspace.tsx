import type { ReactNode } from "react";
import AppIcon from "./AppIcon.jsx";
import SignalMonitor from "./SignalMonitor.tsx";
import AudioStatusBadge from "./AudioStatusBadge.tsx";
import AudioSourceControls from "./AudioSourceControls.tsx";
import { useAudioInput } from "../hooks/useAudioInput.ts";
import { usePitchDetection } from "../hooks/usePitchDetection.ts";
import type { PitchReading } from "../audio/pitch.ts";

// Workspace for a single tone (tuner and note finder).
type Props = {
  title: string;
  icon?: string;
  children: (pitch: PitchReading) => ReactNode;
};

export default function AudioWorkspace({
  title,
  icon = "tune",
  children,
}: Props) {
  const audio = useAudioInput();
  const pitch = usePitchDetection(audio.status === "running", audio.readFrame);

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
      <SignalMonitor
        running={audio.status === "running"}
        sampleRate={audio.sampleRate}
        readFrame={audio.readFrame}
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
