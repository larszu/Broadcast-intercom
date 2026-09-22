import { useState } from "react";
import { useLang } from "../i18n";
import { fuehrungStarten } from "../lib/fuehrung";

const TOTAL_STEPS = 3;

export function FirstStartWizard({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t.wizardStep1Title, body: t.wizardStep1Body },
    { title: t.wizardStep2Title, body: t.wizardStep2Body },
    { title: t.wizardStep3Title, body: t.wizardStep3Body },
  ];

  function finish() {
    localStorage.setItem("wizardDone", "1");
    onDone();
  }

  /**
   * Schliesst die Folien und zeigt den Weg, statt ihn zu beschreiben (#22).
   *
   * Die drei Folien erklaerten, was ein Intercom ist und wie die PTT-Leiste
   * geht — und liessen die eine Frage offen, die jemand beim ERSTEN Start
   * wirklich hat: wie lege ich die Leute an, die nachher sprechen sollen?
   * Ohne einen einzigen Benutzer bleibt jedes Beltpack ohne Rechte, und das
   * merkt man erst, wenn das Handy stumm bleibt.
   */
  function fuehrungBeginnen() {
    localStorage.setItem("wizardDone", "1");
    onDone();
    fuehrungStarten();
  }

  return (
    <div className="wizardOverlay" role="dialog" aria-modal="true" aria-label={t.wizardTitle}>
      <div className="wizardModal">
        <div className="wizardHeader">
          <h2>{t.wizardTitle}</h2>
          <div className="wizardDots" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`wizardDot ${i === step ? "active" : i < step ? "done" : ""}`}
              />
            ))}
          </div>
        </div>

        <div className="wizardBody">
          <h3>{steps[step].title}</h3>
          <p>{steps[step].body}</p>
          {step === TOTAL_STEPS - 1 && (
            <p className="wizardReopenHint">{t.wizardReopenTip}</p>
          )}
        </div>

        <div className="wizardFooter">
          <button className="btnGhost" onClick={finish}>{t.wizardSkip}</button>
          <div className="wizardNavRight">
            {step > 0 && (
              <button className="btnGhost" onClick={() => setStep((s) => s - 1)}>←</button>
            )}
            {step < TOTAL_STEPS - 1
              ? <button className="btnAccent" onClick={() => setStep((s) => s + 1)}>{t.wizardNext}</button>
              : (
                <>
                  <button className="btnGhost" onClick={finish}>{t.wizardFinish}</button>
                  <button className="btnAccent" onClick={fuehrungBeginnen}>{t.wizardShowMe}</button>
                </>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
