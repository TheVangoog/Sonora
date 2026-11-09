import type { AudioMode, InputStatus } from "../audio/AudioInput.ts";

type Props = { status: InputStatus; mode: AudioMode | null };

export default function AudioStatusBadge({ status, mode }: Props) {
  const labels = {
    idle: "Source off",
    starting: "Connecting…",
    running: mode === "demo" ? "Test signal" : "Microphone on",
    paused: "Audio paused",
    error: "Source unavailable",
  };

  return (
    <span
      className={`status-badge ${status === "running" ? "is-live" : ""}`}
      role="status"
    >
      <span className="status-dot" />
      {labels[status]}
    </span>
  );
}
