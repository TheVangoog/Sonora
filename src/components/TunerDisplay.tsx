import { useState } from "react";
import { frequencyToNote, IN_TUNE_CENTS } from "../audio/notes.ts";
import { PITCH_MESSAGES } from "../audio/pitch.ts";
import type { PitchReading } from "../audio/pitch.ts";
import {
  GUITAR_STRINGS,
  nearestString,
  targetForString,
} from "../audio/guitarStrings.ts";

type Props = {
  pitch: PitchReading;
  referenceFrequency?: number;
  instrument?: string;
};

type TuningTarget = {
  name: string; // "B"
  octave: number; // 3
  caption: string; // "B" or "String 2"
  targetFrequency: number;
  cents: number;
  stringNumber: number | null;
};

const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

export default function TunerDisplay({
  pitch,
  referenceFrequency = 440,
  instrument = "chromatic",
}: Props) {
  // "auto": the tuner picks the nearest string; a number: the player chose the string.
  const [chosenString, setChosenString] = useState<number | "auto">("auto");
  const isGuitar = instrument === "guitar";

  const target =
    pitch.status === "detected"
      ? findTarget(pitch.frequency, referenceFrequency, isGuitar, chosenString)
      : null;

  const cents = target ? Math.round(target.cents) : 0;
  const direction = !target
    ? null
    : Math.abs(target.cents) <= IN_TUNE_CENTS
      ? "in-tune"
      : target.cents < 0
        ? "flat"
        : "sharp";
  // The needle shows ±50 cents; beyond that it stops at the edge and shows “far”.
  const isFar = target !== null && Math.abs(target.cents) > 50;
  const needlePosition = 50 + Math.max(-50, Math.min(50, target?.cents ?? 0));
  const held = pitch.status === "detected" && pitch.held === true;

  return (
    <div className={`tuner-display ${held ? "is-held" : ""}`}>
      <span className="display-caption">
        {isGuitar ? "GUITAR STRING TUNER" : "CHROMATIC TUNER"}
      </span>
      <div
        className={`pitch-value ${target ? "has-note" : ""}`}
        aria-label={
          target ? `Target ${target.name}${target.octave}` : "No note detected yet"
        }
      >
        {target ? (
          <>
            {target.name}
            <sup>{target.octave}</sup>
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
        className="tuning-scale"
        role="img"
        aria-label={
          target
            ? `${cents} cents off ${target.name}${target.octave}`
            : "Tuning scale, no note detected"
        }
      >
        <div className="scale-center" />
        <div className="scale-ticks">
          {Array.from({ length: 41 }, (_, index) => (
            <i key={index} className={index % 10 === 0 ? "major" : undefined} />
          ))}
        </div>
        {target && (
          <div
            className={`tuning-needle ${direction} ${isFar ? "is-far" : ""}`}
            style={{ left: `${needlePosition}%` }}
          />
        )}
        <div className="scale-labels">
          <span>−50</span>
          <span>−25</span>
          <span className="zero-label">0</span>
          <span>+25</span>
          <span>+50</span>
        </div>
      </div>
      <div className="scale-description">
        <span>Flat</span>
        <span>{target ? `${cents > 0 ? "+" : ""}${cents} cents` : "cents"}</span>
        <span>Sharp</span>
      </div>
      <p
        className={`waiting-label ${direction === "in-tune" ? "in-tune-text" : ""}`}
      >
        {target
          ? `${target.caption} · ${instruction(direction, isGuitar, isFar)}`
          : PITCH_MESSAGES[pitch.status]}
      </p>
      <p className="reference-label">
        Reference <strong>A₄ = {referenceFrequency} Hz</strong>
        {target && <> · target {target.targetFrequency.toFixed(2)} Hz</>}
      </p>
      {isGuitar && (
        <div
          className="guitar-strings"
          role="group"
          aria-label="Which string you are tuning"
        >
          <button
            aria-pressed={chosenString === "auto"}
            className={chosenString === "auto" ? "string-chosen" : undefined}
            onClick={() => setChosenString("auto")}
          >
            Auto
          </button>
          {GUITAR_STRINGS.map((string) => (
            <button
              key={string.number}
              aria-pressed={chosenString === string.number}
              aria-label={`String ${string.number}, ${string.label}`}
              className={[
                chosenString === string.number ? "string-chosen" : "",
                target?.stringNumber === string.number ? "string-active" : "",
              ].join(" ")}
              onClick={() => setChosenString(string.number)}
            >
              <small>{string.number}</small>
              {string.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function findTarget(
  frequency: number,
  referenceA4: number,
  isGuitar: boolean,
  chosenString: number | "auto",
): TuningTarget | null {
  if (!isGuitar) {
    const note = frequencyToNote(frequency, referenceA4);
    if (!note) return null;
    return {
      name: note.name,
      octave: note.octave,
      caption: note.spokenName,
      targetFrequency: note.targetFrequency,
      cents: note.cents,
      stringNumber: null,
    };
  }

  const picked = GUITAR_STRINGS.find((s) => s.number === chosenString);
  const found = picked
    ? targetForString(frequency, picked, referenceA4)
    : nearestString(frequency, referenceA4);
  return {
    name: found.string.name,
    octave: octaveOf(found.string.midi),
    caption: `String ${found.string.number}`,
    targetFrequency: found.targetFrequency,
    cents: found.cents,
    stringNumber: found.string.number,
  };
}

function instruction(
  direction: string | null,
  isGuitar: boolean,
  isFar: boolean,
): string {
  if (direction === "in-tune") return "Within ±5 cents";
  const far = isFar ? "far off, " : "";
  if (isGuitar) {
    return direction === "flat"
      ? `Too low: ${far}tighten the string`
      : `Too high: ${far}loosen the string`;
  }
  return direction === "flat"
    ? "A bit flat — raise the pitch"
    : "A bit sharp — lower the pitch";
}
