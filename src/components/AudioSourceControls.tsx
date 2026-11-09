import { useId } from "react";
import type { ReactNode } from "react";
import AppIcon from "./AppIcon.jsx";
import type { AudioMode, InputStatus } from "../audio/AudioInput.ts";

// Shared by the tuner and chord pages; page-specific demo controls come via demoSettings.
type Props = {
  status: InputStatus;
  mode: AudioMode | null;
  error: string | null;
  start: (mode: AudioMode) => void;
  stop: () => void;
  demoLabel?: string;
  demoSettings?: ReactNode;
};

export default function AudioSourceControls({
  status,
  mode,
  error,
  start,
  stop,
  demoLabel = "Test signal",
  demoSettings,
}: Props) {
  const hintId = useId();
  const active = ["starting", "running", "paused"].includes(status);

  return (
    <div className="audio-controls">
      <div className="audio-buttons">
        {active ? (
          <button className="stop-button" onClick={stop}>
            {status === "starting" ? "Cancel" : "Stop"}
          </button>
        ) : (
          <>
            <button
              className="microphone-button"
              onClick={() => start("microphone")}
              aria-describedby={hintId}
            >
              <AppIcon name="mic" size={18} />
              Turn on microphone
            </button>
            <button className="demo-button" onClick={() => start("demo")}>
              {demoLabel}
            </button>
          </>
        )}
      </div>
      <p id={hintId}>
        {status === "starting"
          ? "If the browser asks for permission, choose a microphone. You can cancel the wait."
          : status === "paused"
            ? "The browser paused audio. Return to the tab; if needed, stop and start the source again."
            : "Sound is processed here, without recording or sending it to a server."}
      </p>
      {error && (
        <p className="audio-error" role="alert">
          {error}
        </p>
      )}
      {mode === "demo" && active && demoSettings}
    </div>
  );
}
