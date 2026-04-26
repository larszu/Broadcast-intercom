import { useLang, type Lang } from "../i18n";

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
    </div>
  );
}
