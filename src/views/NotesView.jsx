import PageHeading from "../components/PageHeading.jsx";
import AudioWorkspace from "../components/AudioWorkspace.tsx";
import NoteDisplay from "../components/NoteDisplay.tsx";
import GuideCard from "../components/GuideCard.jsx";
import AppIcon from "../components/AppIcon.jsx";

export default function NotesView() {
  return (
    <>
      <PageHeading
        eyebrow="A SPACE TO PRACTISE"
        title="Get to know your sound."
        description="Every sound has a name. Find out which note is playing."
      />
      <div className="workspace-grid">
        <div>
          <div className="tool-settings">
            <span className="mode-label">
              <AppIcon name="note" size={17} />
              One note at a time
            </span>
            <span className="mode-caption">C · D · E · F · G · A · B</span>
          </div>
          <AudioWorkspace title="Note finder" icon="note">
            {(pitch) => <NoteDisplay pitch={pitch} />}
          </AudioWorkspace>
          <p className="under-card">
            <AppIcon name="info" size={15} />
            The frequency is measured from the sound. The keyboard shows the detected note,
            and the number next to it is the octave.
          </p>
        </div>
        <GuideCard mode="notes" />
      </div>
    </>
  );
}
