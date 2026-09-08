// ───────────────────────────────────────────────────────────────────────────
// Den Intercom-Plan aus dem AV-Planner einlesen (B-41.2).
//
// Zwei Schritte, und der erste ist nicht optional: erst der Abgleich, dann das
// Uebernehmen. Wer den Knopf drueckt, schreibt Sprechberechtigungen in eine
// Anlage, an der gleich jemand arbeitet — er soll vorher lesen koennen, was
// sich bewegt. Deshalb ist „Uebernehmen" bis zum Abgleich gar nicht da, und
// nicht bloss ausgegraut: ein Knopf, der aussieht wie ein Knopf und nichts
// tut, ist die naechste Frage statt einer Antwort.
// ───────────────────────────────────────────────────────────────────────────
import { useRef, useState } from "react";
import type { IntercomPlanDiff } from "@broadcast/shared";
import { useLang } from "../i18n";

interface Props {
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

interface PlanAntwort {
  ok: boolean;
  diff?: IntercomPlanDiff;
  error?: string;
}

export function PlanImport({ api }: Props) {
  const { t } = useLang();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState<string>("");
  const [diff, setDiff] = useState<IntercomPlanDiff | null>(null);
  const [fehler, setFehler] = useState<string>("");
  const [uebernommen, setUebernommen] = useState(false);
  const [busy, setBusy] = useState(false);

  const waehlen = async (datei: File | undefined) => {
    if (!datei) return;
    setFehler("");
    setDiff(null);
    setUebernommen(false);
    setDateiname(datei.name);
    setText(await datei.text());
  };

  const abgleichen = async () => {
    if (!text) return;
    setBusy(true);
    setFehler("");
    setUebernommen(false);
    try {
      const r = await api<PlanAntwort>("POST", "/api/plan/preview", { plan: text });
      if (r.ok && r.diff) setDiff(r.diff);
      else setFehler(r.error || t.planErrorGeneric);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const uebernehmen = async () => {
    if (!text) return;
    setBusy(true);
    setFehler("");
    try {
      const r = await api<PlanAntwort>("POST", "/api/plan/apply", { plan: text });
      if (r.ok && r.diff) {
        setDiff(r.diff);
        setUebernommen(true);
      } else {
        setFehler(r.error || t.planErrorGeneric);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const liste = (titel: string, namen: string[], hinweis?: string) =>
    namen.length === 0 ? null : (
      <div className="planDiffGroup">
        <h4>
          {titel} <span className="planDiffCount">{namen.length}</span>
        </h4>
        {hinweis && <p className="planDiffHint">{hinweis}</p>}
        <ul className="planDiffList">
          {namen.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="viewPanel">
      <h2>{t.planTitle}</h2>
      <p className="planIntro">{t.planIntro}</p>

      <div className="settingsRow">
        <input
          ref={dateiRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void waehlen(e.target.files?.[0])}
        />
      </div>

      {text && (
        <div className="settingsRow">
          <button className="btnGhost" onClick={() => void abgleichen()} disabled={busy}>
            {t.planPreview}
          </button>
          {/* Erst nach dem Abgleich. Siehe Kopfkommentar. */}
          {diff && !uebernommen && (
            <button className="btn btnPrimary" onClick={() => void uebernehmen()} disabled={busy}>
              {t.planApply}
            </button>
          )}
          <span className="planFileName">{dateiname}</span>
        </div>
      )}

      {fehler && <p className="planError">{fehler}</p>}
      {uebernommen && <p className="planOk">{t.planApplied}</p>}

      {diff && (
        <div className="planDiff">
          <p className="planDiffHead">
            {diff.systemName || "—"}
            {diff.exportedAt ? ` · ${new Date(diff.exportedAt).toLocaleString()}` : ""}
          </p>

          {/* Der Satz aus der Datei, woher ihre Angaben stammen. Er steht hier,
              weil eine aus Green-GO abgeleitete Datei talk UND listen gesetzt
              hat — das ist die aermere Quelle, keine Messung. */}
          {diff.derivedFrom && <p className="planDerivedFrom">{diff.derivedFrom}</p>}

          <div className="planDiffCols">
            <div>
              <h3>{t.planChannels}</h3>
              {liste(t.planAdded, diff.channels.added.map((c) => c.name))}
              {liste(t.planUnchanged, diff.channels.unchanged.map((c) => c.name))}
              {liste(
                t.planKept,
                diff.channels.keptOutsidePlan.map((c) => c.name),
                t.planKeptHint,
              )}
            </div>
            <div>
              <h3>{t.planStations}</h3>
              {liste(t.planAdded, diff.users.added.map((u) => u.name))}
              {liste(
                t.planUpdated,
                diff.users.updated.map((u) => `${u.name} — ${u.changes.join(", ")}`),
              )}
              {liste(t.planUnchanged, diff.users.unchanged.map((u) => u.name))}
              {liste(t.planKept, diff.users.keptOutsidePlan.map((u) => u.name), t.planKeptHint)}
            </div>
          </div>

          {diff.skipped.length > 0 && (
            <div className="planDiffGroup planDiffWarn">
              <h4>
                {t.planSkipped} <span className="planDiffCount">{diff.skipped.length}</span>
              </h4>
              <p className="planDiffHint">{t.planSkippedHint}</p>
              <ul className="planDiffList">
                {diff.skipped.map((sk, i) => (
                  <li key={`${sk.where}-${sk.index}-${i}`}>
                    {sk.where} #{sk.index}
                    {sk.context ? ` (${sk.context})` : ""} — {sk.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.danglingMemberships.length > 0 && (
            <div className="planDiffGroup planDiffWarn">
              <h4>
                {t.planDangling} <span className="planDiffCount">{diff.danglingMemberships.length}</span>
              </h4>
              <p className="planDiffHint">{t.planDanglingHint}</p>
              <ul className="planDiffList">
                {diff.danglingMemberships.map((d, i) => (
                  <li key={`${d.station}-${d.channelId}-${i}`}>
                    {d.station} → {d.channelId}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
