import { useState } from "react";
import PageHeading from "../components/PageHeading.jsx";
import AudioWorkspace from "../components/AudioWorkspace.tsx";
import TunerDisplay from "../components/TunerDisplay.tsx";
import GuideCard from "../components/GuideCard.jsx";
import AppIcon from "../components/AppIcon.jsx";

export default function TunerView() {
  const [instrument, setInstrument] = useState("chromatic");
  const [referenceFrequency, setReferenceFrequency] = useState(440);

  return (
    <>
      <PageHeading
        eyebrow="A SPACE TO PRACTISE"
        title="Find your pitch."
        description="Tune your instrument. Focus on the music."
      />
      <div className="workspace-grid">
        <div>
          <div className="tool-settings">
            <div
              className="instrument-switch"
              role="group"
              aria-label="Tuner type"
            >
              <button
                aria-pressed={instrument === "chromatic"}
                className={instrument === "chromatic" ? "selected" : undefined}
                onClick={() => setInstrument("chromatic")}
              >
                Chromatic
              </button>
              <button
                aria-pressed={instrument === "guitar"}
                className={instrument === "guitar" ? "selected" : undefined}
                onClick={() => setInstrument("guitar")}
              >
                Guitar
              </button>
            </div>
            <label className="reference-select">
              A₄
              <select
                value={referenceFrequency}
                onChange={(event) =>
                  setReferenceFrequency(Number(event.target.value))
                }
                aria-label="Reference frequency of A4"
              >
                <option value={432}>432 Hz</option>
                <option value={440}>440 Hz</option>
                <option value={442}>442 Hz</option>
              </select>
            </label>
          </div>
          <AudioWorkspace title="Tuner">
            {(pitch) => (
              <TunerDisplay
                pitch={pitch}
                instrument={instrument}
                referenceFrequency={referenceFrequency}
              />
            )}
          </AudioWorkspace>
          <p className="under-card">
            <AppIcon name="info" size={15} />
            Play one note. When it is quiet or the signal is unclear, the previous result
            is cleared.
          </p>
        </div>
        <GuideCard />
      </div>
    </>
  );
}
