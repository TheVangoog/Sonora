import AppIcon from "./AppIcon.jsx";

export default function GuideCard({ mode = "tuner" }) {
  return (
    <section className="guide-card">
      <div className="guide-icon">
        <AppIcon name="headphones" size={23} />
      </div>
      <h2>Find your note</h2>
      <p>Check the detection on a known sound.</p>
      <ol className="steps">
        <li>
          <span>1</span>
          <div>
            <strong>Start the test signal</strong>
            <p>No microphone needed. The generator is silent.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Compare set and measured</strong>
            <p>Set 440 Hz: we expect the note A4. Then try 220 and 880 Hz.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Compare with the microphone</strong>
            <p>
              {mode === "tuner"
                ? "Stop the test, turn on the microphone and play one string."
                : "Stop the test, turn on the microphone and sing one note."}
            </p>
          </div>
        </li>
      </ol>
      <div className="guide-note">
        <AppIcon name="info" size={17} />
        <p>
          Works with one tone in the 60–1500 Hz range. For chords, open
          the Chords page.
        </p>
      </div>
    </section>
  );
}
