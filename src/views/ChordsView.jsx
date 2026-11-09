import PageHeading from "../components/PageHeading.jsx";
import ChordWorkspace from "../components/ChordWorkspace.tsx";
import AppIcon from "../components/AppIcon.jsx";

export default function ChordsView() {
  return (
    <>
      <PageHeading
        eyebrow="A SPACE TO PRACTISE"
        title="Hear your chord."
        description="Strum the strings — Sonora names the chord and shows which notes sound."
      />
      <div className="workspace-grid">
        <div>
          <ChordWorkspace />
          <p className="under-card">
            <AppIcon name="info" size={15} />
            Recognizes major, minor, seventh, dim, aug and power chords. A new chord appears
            after about 0.2 s (algorithm) or 1–2 s (AI) and stays while the strings ring.
          </p>
        </div>
        <section className="guide-card">
          <div className="guide-icon">
            <AppIcon name="chord" size={23} />
          </div>
          <h2>How it works</h2>
          <ol className="steps">
            <li>
              <span>1</span>
              <div>
                <strong>Spectrum</strong>
                <p>FFT splits a frame of 8192 samples into frequencies.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Chroma</strong>
                <p>All frequencies are summed into 12 notes; octaves do not matter.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Templates</strong>
                <p>
                  The 12 numbers are compared with 108 chord templates and the best
                  match wins.
                </p>
              </div>
            </li>
          </ol>
          <div className="guide-note">
            <AppIcon name="info" size={17} />
            <p>
              Start with the test chord: pick Am and check that the bars A,
              C and E are the highest.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
