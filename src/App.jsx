import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import AppHeader from "./components/AppHeader.jsx";
import AppRoutes from "./router/index.jsx";

const titles = {
  "/": "Tuner",
  "/tuner": "Tuner",
  "/notes": "Note finder",
  "/chords": "Chord recognizer",
  "/record": "Dataset recording",
};

export default function App() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    document.title = `Sonora — ${titles[pathname] ?? "Page not found"}`;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  function skipToContent(event) {
    // Do not change the hash: the router uses it.
    event.preventDefault();
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView();
  }

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={skipToContent}>
        Skip to content
      </a>
      <AppHeader />
      <main
        id="main-content"
        className="page-container"
        tabIndex={-1}
        ref={mainRef}
      >
        <AppRoutes />
      </main>
      <footer className="app-footer page-container">
        <span>Your instrument. Your sound.</span>
        <span>
          AI model:{" "}
          <a href="https://github.com/spotify/basic-pitch" target="_blank" rel="noreferrer">
            Basic Pitch by Spotify
          </a>{" "}
          (Apache 2.0)
        </span>
        <span className="footer-version">
          <span className="status-dot" /> Sonora{" "}
          <span className="version">v0.1</span>
        </span>
      </footer>
    </>
  );
}
