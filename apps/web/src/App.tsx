import { useState } from "react";
import type { CoreState } from "@broadcast/shared";
import { useIntercomStore } from "./hooks/useIntercomStore";
import { StartScreen } from "./views/StartScreen";
import { PhoneClient } from "./views/PhoneClient";
import { MonitorView } from "./views/MonitorView";
import { ConfigView } from "./views/ConfigView";
import { FirstStartWizard } from "./views/FirstStartWizard";
import { useLang } from "./i18n";

type Page = "monitor" | "setup";

export default function App() {
  const { state, setState, events, connected, sendWs, api, setAudioChunkHandler } = useIntercomStore();
  const { t } = useLang();
  const searchParams = new URLSearchParams(window.location.search);
  const isClientMode = searchParams.get("mode") === "client"
    || searchParams.get("client") === "phone"
    || searchParams.get("client") === "web";
  const [showStart, setShowStart] = useState(!isClientMode);
  const [page, setPage] = useState<Page>("monitor");
  const [showWizard, setShowWizard] = useState(() => !isClientMode && !localStorage.getItem("wizardDone"));
  const [saveAsName, setSaveAsName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);

  function handleEnter(loadedState: CoreState) {
    setState(loadedState);
    setShowStart(false);
  }

  async function saveConfig() {
    await api("POST", "/api/configs/save");
  }

  async function saveConfigAs() {
    if (!saveAsName.trim()) return;
    await api("POST", "/api/configs/save", { name: saveAsName.trim() });
    setShowSaveAs(false);
    setSaveAsName("");
  }



  if (isClientMode) {
    return <PhoneClient state={state} sendWs={sendWs} connected={connected} setAudioChunkHandler={setAudioChunkHandler} />;
  }

  if (showStart) {
    return <StartScreen onEnter={handleEnter} api={api} />;
  }


  return (
    <div className="appLayout">
      <header className="appTopBar">
        <div className="topBarBrand">
          <span className="brandIcon">🎤</span>
          <span className="brandName">{t.appTitle}</span>
          <span className={`connPill ${connected ? "on" : "off"}`}>
            {connected ? t.dashOnline : t.dashOffline}
          </span>
        </div>

        <nav className="topBarNav">
          <button
            className={`topNavBtn ${page === "monitor" ? "active" : ""}`}
            onClick={() => setPage("monitor")}
          >
            {t.navMonitor}
          </button>
          <button
            className={`topNavBtn ${page === "setup" ? "active" : ""}`}
            onClick={() => setPage("setup")}
          >
            {t.navSetup}
          </button>
        </nav>

        <div className="topBarActions">
          <span className="configLabel">{state.activeConfig.name}</span>
          <button className="topBarBtn" onClick={saveConfig}>{t.configSave}</button>
          <button className="topBarBtn" onClick={() => setShowSaveAs((s) => !s)}>{t.configSaveAs}</button>
          <button className="topBarBtnIcon" title={t.configHelpTip} onClick={() => setShowWizard(true)}>?</button>
        </div>
      </header>

      {showSaveAs && (
        <div className="saveAsBar">
          <input
            autoFocus
            placeholder={t.configSaveAsPlaceholder}
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { void saveConfigAs(); } if (e.key === "Escape") setShowSaveAs(false); }}
          />
          <button onClick={() => { void saveConfigAs(); }}>{t.configSaveBtn}</button>
          <button className="btnGhost" onClick={() => setShowSaveAs(false)}>{t.configCancel}</button>
        </div>
      )}

      <main className="appMain">
        {page === "monitor" && (
          <MonitorView
            state={state}
            events={events}
            api={api}
          />
        )}
        {page === "setup" && (
          <ConfigView state={state} events={events} api={api} />
        )}
      </main>

      {showWizard && <FirstStartWizard onDone={() => setShowWizard(false)} />}
    </div>
  );
}
