import { useEffect, useState } from "react";
import type { CoreState } from "@broadcast/shared";
import { useIntercomStore } from "./hooks/useIntercomStore";
import { StartScreen } from "./views/StartScreen";
import { PhoneClient } from "./views/PhoneClient";
import { MonitorView } from "./views/MonitorView";
import { ConfigView } from "./views/ConfigView";
import { FirstStartWizard } from "./views/FirstStartWizard";
import { FuehrungsHost } from "./views/FuehrungsHost";
import { useFuehrung, fuehrungStarten, fuehrungErledigt } from "./lib/fuehrung";
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

  /*
    Die Fuehrung (#22) wechselt die Seite nicht selbst — sie sagt nur, wo ihr
    Ziel liegt, und jede Ebene schaltet ihren eigenen Zustand um. Sonst
    haetten zwei Stellen dieselbe Hoheit ueber `page`, und wer die Seite
    waehrend der Fuehrung von Hand wechselt, kaempft gegen sie an.
  */
  const fuehrung = useFuehrung();
  useEffect(() => {
    if (fuehrung.schritt?.seite && fuehrung.schritt.seite !== page) {
      setPage(fuehrung.schritt.seite);
    }
  }, [fuehrung.schritt, page]);

  /*
    Beim ersten Start von selbst dorthin, wo es losgeht (#22).

    Die Bedingung ist nicht „erster Start", sondern „es gibt keinen einzigen
    Benutzer". Das ist dieselbe Lage und die ehrlichere Frage: wer die
    Einfuehrung beim ersten Mal weggeklickt hat und beim zweiten Start immer
    noch vor einer Anlage ohne Benutzer steht, hat dieselbe Huerde vor sich.
    Umgekehrt faengt eine eingerichtete Anlage nach einem Browserwechsel
    nicht wieder mit der Fuehrung an.

    Einmal — `fuehrungErledigt()` merkt sich das Durchlaufen, und wer
    abbricht, hat abgebrochen.
  */
  const ohneBenutzer = Object.keys(state.users || {}).length === 0;
  useEffect(() => {
    if (isClientMode || showStart || showWizard) return;
    if (!ohneBenutzer || fuehrungErledigt()) return;
    fuehrungStarten();
  }, [isClientMode, showStart, showWizard, ohneBenutzer]);
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
            data-fuehrung="nav-setup"
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
      <FuehrungsHost />
    </div>
  );
}
