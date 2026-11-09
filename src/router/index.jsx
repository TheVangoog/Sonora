import { Navigate, Route, Routes } from "react-router";
import TunerView from "../views/TunerView.jsx";
import NotesView from "../views/NotesView.jsx";
import ChordsView from "../views/ChordsView.jsx";
import RecordView from "../views/RecordView.jsx";
import NotFoundView from "../views/NotFoundView.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tuner" replace />} />
      <Route path="/tuner" element={<TunerView />} />
      <Route path="/notes" element={<NotesView />} />
      <Route path="/chords" element={<ChordsView />} />
      <Route path="/record" element={<RecordView />} />
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}
