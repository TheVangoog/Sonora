import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App.jsx";
import { SettingsProvider } from "./settings/SettingsContext.tsx";
import { AccountProvider } from "./account/AccountContext.tsx";
import "./styles.css";

console.info(`Sonora build ${__SONORA_COMMIT__}`);

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <SettingsProvider>
      <AccountProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AccountProvider>
    </SettingsProvider>
  </StrictMode>,
);
