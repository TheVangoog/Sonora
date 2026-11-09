import { Link, NavLink } from "react-router";
import AppIcon from "./AppIcon.jsx";

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="header-inner page-container">
        <Link to="/tuner" className="brand" aria-label="Sonora — home">
          <span className="brand-mark">
            <AppIcon name="wave" size={23} />
          </span>
          sonora<span className="brand-period">.</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/tuner">
            <AppIcon name="tune" size={18} />
            Tuner
          </NavLink>
          <NavLink to="/notes">
            <AppIcon name="note" size={18} />
            Notes
          </NavLink>
          <NavLink to="/chords">
            <AppIcon name="chord" size={18} />
            Chords
          </NavLink>
          <NavLink to="/record">
            <AppIcon name="mic" size={18} />
            Record
          </NavLink>
        </nav>
        <span className="header-caption">A small space for a big sound</span>
      </div>
    </header>
  );
}
