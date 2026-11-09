import { useEffect, useState } from "react";
import AppIcon from "./AppIcon.jsx";
import { recordTake } from "../audio/takeRecorder.ts";
import { encodeWav } from "../audio/wav.ts";
import type { DecodedAudio } from "../audio/wav.ts";
import { measureSignal } from "../audio/signal.ts";
import { CHORD_LABELS, NO_CHORD_LABELS } from "../audio/datasetLabels.ts";
import { ChordDetector, CHORD_FRAME_SIZE } from "../audio/chords.ts";

// Labelled WAV takes for the test bench (npm run eval).
const TAKE_SECONDS = 3;
const COUNTDOWN_SECONDS = 3;

type Phase = "ready" | "countdown" | "recording" | "done" | "error";

export default function RecordWorkspace() {
  const [label, setLabel] = useState("Am");
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(0);
  const [take, setTake] = useState<DecodedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  // How many takes are already saved per label (for the number in the file name).
  const [savedCounts, setSavedCounts] = useState<Record<string, number>>({});

  async function startTake() {
    setError(null);
    setTake(null);
    setPhase("countdown");
    for (let s = COUNTDOWN_SECONDS; s > 0; s--) {
      setCountdown(s);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setPhase("recording");
    try {
      setTake(await recordTake(TAKE_SECONDS));
      setPhase("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhase("error");
    }
  }

  function saveTake() {
    if (!take) return;
    const number = (savedCounts[label] ?? 0) + 1;
    const fileName = `${label}__${String(number).padStart(2, "0")}.wav`;
    const blob = new Blob([encodeWav(take.samples, take.sampleRate)], {
      type: "audio/wav",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setSavedCounts({ ...savedCounts, [label]: number });
    setPhase("ready");
    setTake(null);
  }

  return (
    <section className="audio-workspace" aria-label="Dataset recording">
      <header className="workspace-header">
        <h2>
          <AppIcon name="mic" size={19} />
          Recording for the test bench
        </h2>
      </header>
      <div className="record-body">
        <p className="record-step">1. What you will play</p>
        <div className="record-labels" role="group" aria-label="Take label">
          {CHORD_LABELS.map((name) => (
            <LabelButton key={name} name={name} text={name} selected={label} onPick={setLabel} count={savedCounts[name]} />
          ))}
          {NO_CHORD_LABELS.map((item) => (
            <LabelButton key={item.label} name={item.label} text={item.description} selected={label} onPick={setLabel} count={savedCounts[item.label]} />
          ))}
        </div>

        <p className="record-step">2. Record ({TAKE_SECONDS} s)</p>
        <button
          className="microphone-button"
          onClick={startTake}
          disabled={phase === "countdown" || phase === "recording"}
        >
          <AppIcon name="mic" size={18} />
          {phase === "countdown"
            ? `Get ready… ${countdown}`
            : phase === "recording"
              ? "Play! Recording…"
              : `Record “${label}”`}
        </button>
        {error && (
          <p className="audio-error" role="alert">
            {error}
          </p>
        )}

        {take && <TakeReview take={take} label={label} onSave={saveTake} onRetry={startTake} />}
      </div>
    </section>
  );
}

function LabelButton({
  name,
  text,
  selected,
  onPick,
  count,
}: {
  name: string;
  text: string;
  selected: string;
  onPick: (name: string) => void;
  count?: number;
}) {
  return (
    <button
      aria-pressed={selected === name}
      className={selected === name ? "selected" : undefined}
      onClick={() => onPick(name)}
    >
      {text}
      {count ? <small> ·{count}</small> : null}
    </button>
  );
}

function TakeReview({
  take,
  label,
  onSave,
  onRetry,
}: {
  take: DecodedAudio;
  label: string;
  onSave: () => void;
  onRetry: () => void;
}) {
  const [heard, setHeard] = useState<string>("…");
  const level = measureSignal(take.samples);

  useEffect(() => {
    // Take a frame from the middle to skip the pick attack at the start.
    const start = Math.max(0, Math.floor(take.samples.length / 2 - CHORD_FRAME_SIZE / 2));
    const frame = take.samples.slice(start, start + CHORD_FRAME_SIZE);
    if (frame.length < CHORD_FRAME_SIZE) return setHeard("take too short");
    const reading = new ChordDetector(CHORD_FRAME_SIZE).analyze(frame, take.sampleRate);
    const best = reading.candidates[0];
    setHeard(
      reading.status === "detected"
        ? `${reading.chord.name} (${Math.round(reading.confidence * 100)}%)`
        : best
          ? `not sure, closest ${best.template.name}`
          : "nothing (quiet)",
    );
  }, [take]);

  return (
    <div className="take-review">
      <p className="record-step">3. Check and save</p>
      <dl className="signal-stats">
        <div>
          <dt>Level</dt>
          <dd>{Number.isFinite(level.dbfs) ? `${level.dbfs.toFixed(1)} dBFS` : "−∞"}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{level.peak >= 0.99 ? "clipping!" : level.peak.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Recognizer hears</dt>
          <dd>{heard}</dd>
        </div>
      </dl>
      <div className="audio-buttons">
        <button className="microphone-button" onClick={onSave}>
          Save “{label}” as WAV
        </button>
        <button className="demo-button" onClick={onRetry}>
          Record again
        </button>
      </div>
    </div>
  );
}
