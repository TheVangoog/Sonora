import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App.jsx";
import { SettingsProvider } from "./settings/SettingsContext.tsx";
import "./styles.css";

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <SettingsProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </SettingsProvider>
  </StrictMode>,
);
