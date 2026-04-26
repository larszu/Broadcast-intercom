import { useState } from "react";
import { useLang } from "../i18n";

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
              : <button className="btnAccent" onClick={finish}>{t.wizardFinish}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
