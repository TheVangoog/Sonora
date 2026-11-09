import { NOTE_NAMES } from "../audio/notes.ts";
import { CHORD_MESSAGES, MIN_TONE_LEVEL } from "../audio/chords.ts";
import { MARGIN_DB } from "../audio/levelGate.ts";
import type { ChordState } from "../hooks/useChordDetection.ts";

// Priority: shownChord (confident) → likelyChord (guess, muted) → heldChord (faded).
export default function ChordDisplay({
  reading,
  shownChord,
  likelyChord,
  heldChord,
  roomDbfs,
  analysisMs,
}: ChordState) {
  const chord = shownChord ?? likelyChord ?? heldChord;
  const isHeld = !shownChord && !likelyChord && heldChord !== null;
  const isGuess = !shownChord && likelyChord !== null;
  const chordTones = new Set(chord?.tones ?? []);
  const confidencePercent = Math.round(reading.confidence * 100);

  return (
    <div className="chord-display">
      <span className="display-caption">CHORD RECOGNITION</span>

      <div
        className={`chord-value ${chord ? "has-chord" : ""} ${isGuess ? "is-guess" : ""} ${isHeld ? "is-held" : ""}`}
        aria-label={
          chord
            ? `${isHeld ? "Last chord" : isGuess ? "Probably chord" : "Chord"} ${chord.name}`
            : "No chord detected yet"
        }
      >
        {chord ? chord.name : "—"}
      </div>
      <p className="chord-name">
        {chord
          ? isHeld
            ? `Last chord: ${chord.fullName}`
            : isGuess
              ? `Probably: ${chord.fullName} · not sure`
              : chord.fullName
          : CHORD_MESSAGES[reading.status]}
      </p>

      {chord && (
        <ul
          className={`chord-tones ${isGuess || isHeld ? "is-guess" : ""}`}
          aria-label="Chord notes"
        >
          {chord.tones.map((tone) => (
            <li key={tone}>
              <strong>{NOTE_NAMES[tone]}</strong>
            </li>
          ))}
        </ul>
      )}

      <ChromaBars chroma={reading.chroma} chordTones={chordTones} />

      <div className="chord-candidates" aria-label="Closest chords">
        {reading.candidates.map(({ template, score }) => (
          <div key={template.name} className="chord-candidate">
            <span>{template.name}</span>
            <i>
              <b style={{ width: `${Math.round(score * 100)}%` }} />
            </i>
            <output>{Math.round(score * 100)}%</output>
          </div>
        ))}
      </div>

      <p className="reference-label">
        Latest frame match{" "}
        <strong>{reading.chroma ? `${confidencePercent}%` : "—"}</strong> ·
        room silence{" "}
        <strong>
          {roomDbfs === null ? "measuring…" : `${roomDbfs.toFixed(0)} dBFS`}
        </strong>{" "}
        · reacting to sound above{" "}
        <strong>
          {roomDbfs === null
            ? "—"
            : `${(roomDbfs + MARGIN_DB).toFixed(0)} dBFS`}
        </strong>
        {analysisMs !== null && (
          <>
            {" "}
            · AI analysis <strong>{Math.round(analysisMs)} ms</strong>
          </>
        )}
      </p>
    </div>
  );
}

// The dashed line is MIN_TONE_LEVEL: every chord tone must reach it.
function ChromaBars({
  chroma,
  chordTones,
}: {
  chroma: number[] | null;
  chordTones: Set<number>;
}) {
  return (
    <div
      className="chroma-bars"
      role="img"
      aria-label="Strength of each of the 12 notes in the sound"
    >
      <span
        className="chroma-threshold"
        style={{ bottom: `${MIN_TONE_LEVEL * 100}%` }}
      />
      {NOTE_NAMES.map((name, index) => (
        <div
          key={name}
          className={`chroma-bar ${chordTones.has(index) ? "is-chord-tone" : ""}`}
        >
          <i style={{ height: `${Math.round((chroma?.[index] ?? 0) * 100)}%` }} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}
