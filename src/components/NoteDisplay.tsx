import { frequencyToNote } from "../audio/notes.ts";
import { PITCH_MESSAGES } from "../audio/pitch.ts";
import type { PitchReading } from "../audio/pitch.ts";

const keys = [
  { name: "C", value: 0 },
  { name: "D", value: 2 },
  { name: "E", value: 4 },
  { name: "F", value: 5 },
  { name: "G", value: 7 },
  { name: "A", value: 9 },
  { name: "B", value: 11 },
];

export default function NoteDisplay({ pitch }: { pitch: PitchReading }) {
  const note =
    pitch.status === "detected" ? frequencyToNote(pitch.frequency) : null;
  return (
    <div className="note-display">
      <span className="display-caption">SINGLE NOTE DETECTION</span>
      <div
        className={`pitch-value ${note ? "has-note" : ""}`}
        aria-label={note ? `Note ${note.label}` : "No note detected yet"}
      >
        {note ? (
          <>
            {note.name}
            <sup>{note.octave}</sup>
          </>
        ) : (
          "—"
        )}
      </div>
      <div className="frequency-value">
        {pitch.status === "detected" ? pitch.frequency.toFixed(1) : "—"}{" "}
        <span>Hz · measured</span>
      </div>
      <div
        className="piano"
        role="img"
        aria-label={
          note
            ? `Highlighted note ${note.name}; detected octave ${note.octave}`
            : "Keyboard: no note detected"
        }
      >
        {keys.map((key, index) => (
          <div
            key={key.name}
            className={`piano-key ${note?.pitchClass === key.value ? "key-active" : ""}`}
          >
            <span>{key.name}</span>
            {![2, 6].includes(index) && (
              <i
                className={
                  note?.pitchClass === key.value + 1 ? "key-active" : undefined
                }
              />
            )}
          </div>
        ))}
      </div>
      <p className="waiting-label">
        {note
          ? `${note.spokenName} · octave ${note.octave}`
          : PITCH_MESSAGES[pitch.status]}
      </p>
      <p className="reference-label">One tone at a time · reference A₄ = 440 Hz</p>
    </div>
  );
}
