import { useLang, type Lang } from "../i18n";
import { DeviceLibrarySettings } from "./DeviceLibrarySettings";
import hauptlogo from "../assets/brand/lzm_hauptlogo_offwhite.svg";

export function HostSettings() {
  const { t, lang, setLang } = useLang();

  return (
    <div className="viewPanel">
      <h2>{t.settingsTitle}</h2>
      <div className="softSection">
        <h3>{t.settingsLanguage}</h3>
        <div className="settingsRow">
          <label>
            <input
              type="radio"
              name="uiLang"
              value="en"
              checked={lang === "en"}
              onChange={() => setLang("en" as Lang)}
            />
            {" "}{t.settingsLanguageEn}
          </label>
          <label>
            <input
              type="radio"
              name="uiLang"
              value="de"
              checked={lang === "de"}
              onChange={() => setLang("de" as Lang)}
            />
            {" "}{t.settingsLanguageDe}
          </label>
        </div>
      </div>
      <DeviceLibrarySettings />
      <div className="softSection">
        <h3>{t.settingsAbout}</h3>
        <img className="aboutLogo" src={hauptlogo} alt={t.aboutCompany} />
        <p className="aboutLine">{t.appTitle}</p>
        <p className="aboutLine muted">{t.aboutVersion} {__APP_VERSION__}</p>
        <p className="aboutLine muted">{t.aboutCompany}</p>
      </div>
    </div>
  );
}
