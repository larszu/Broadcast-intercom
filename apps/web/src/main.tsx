import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import "./styles.css";

// Browser beltpack as an installable app (PWA). Only in client mode: the
// operator UI is not meant to be installed on a phone, and the manifest's
// start page is the beltpack. Service workers need a secure context (HTTPS
// on the LAN, or localhost); on plain http the page works as before.
if (new URLSearchParams(location.search).get("mode") === "client") {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/manifest.webmanifest";
  document.head.appendChild(manifest);
  if (import.meta.env.PROD && window.isSecureContext && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>
);
