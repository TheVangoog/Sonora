import PageHeading from "../components/PageHeading.jsx";
import RecordWorkspace from "../components/RecordWorkspace.tsx";
import AppIcon from "../components/AppIcon.jsx";

export default function RecordView() {
  return (
    <>
      <PageHeading
        eyebrow="DATA FOR RESEARCH"
        title="Record your guitar."
        description="The recordings become a test set: on them we fairly measure the accuracy of the algorithm and the AI model."
      />
      <div className="workspace-grid">
        <div>
          <RecordWorkspace />
          <p className="under-card">
            <AppIcon name="info" size={15} />
            Sound is recorded without processing (no noise suppression or auto gain) and
            stays only in your browser until you press “Save”.
          </p>
        </div>
        <section className="guide-card">
          <div className="guide-icon">
            <AppIcon name="headphones" size={23} />
          </div>
          <h2>How to record</h2>
          <ol className="steps">
            <li>
              <span>1</span>
              <div>
                <strong>Each chord 5–10 times</strong>
                <p>Soft, normal and loud; downstrokes and fingerpicking.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>“No chord” recordings</strong>
                <p>One string, silence, speech. They check for false alarms.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Collect the files</strong>
                <p>
                  Put the WAV files into tests/recordings/real and run
                  npm run eval.
                </p>
              </div>
            </li>
          </ol>
          <div className="guide-note">
            <AppIcon name="info" size={17} />
            <p>
              If it says “clipping!”, move the guitar away from the microphone and
              record again.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
