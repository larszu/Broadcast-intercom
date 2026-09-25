import { useState } from "react";
import { useLang, type Strings } from "../i18n";
import { actions, useDeviceLibrary, type OwnDeviceType } from "../lib/deviceLibrary/deviceLibraryStore";
import { deviceUrl, LibraryError } from "../lib/deviceLibrary/deviceLibraryClient";
import {
  DEVICE_KINDS,
  DEVICE_TRANSPORTS,
  DEVICE_TYPE_FORMAT,
  DEVICE_TYPE_VERSION,
  keyCount,
  POWER_SOURCES,
  PROTOCOLS,
  readDeviceType,
  type DeviceKind,
  type IntercomDeviceType,
  type IntercomDeviceTypeFacet,
} from "../lib/deviceLibrary/intercomDeviceType";
import type { LibraryEntry } from "../lib/deviceLibrary/librarySync";
import { libraryErrorText } from "./DeviceLibrarySettings";

export const kindLabel = (t: Strings, k: DeviceKind): string =>
  ({ beltpack: t.dtKindBeltpack, deskstation: t.dtKindDeskstation, antenna: t.dtKindAntenna, interface: t.dtKindInterface })[k];

const statusLabel = (t: Strings, s: LibraryEntry["status"]): string =>
  ({ verified: t.dtStatusVerified, confirmed: t.dtStatusConfirmed, unconfirmed: t.dtStatusUnconfirmed, disputed: t.dtStatusDisputed })[s];

function summary(t: Strings, f: IntercomDeviceTypeFacet): string {
  const parts = [kindLabel(t, f.kind), f.transports.join(" / ")];
  if (f.keys) parts.push(`${keyCount(f)} ${t.dtKeys} (${f.keys.pages}×${f.keys.perPage})`);
  if (f.dectCapacity) parts.push(`${f.dectCapacity} × ${t.dtKindBeltpack}`);
  if (f.protocols?.length) parts.push(f.protocols.join(", "));
  return parts.join(" · ");
}

const blankFacet = (): IntercomDeviceTypeFacet => ({
  format: DEVICE_TYPE_FORMAT,
  version: DEVICE_TYPE_VERSION,
  kind: "beltpack",
  transports: ["ethernet"],
  keys: { pages: 1, perPage: 4 },
});

const newId = () => `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function toggle<T>(list: T[] | undefined, v: T): T[] {
  const l = list ?? [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

const num = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s));

function TypeForm({ initial, onDone }: { initial: OwnDeviceType; onDone: () => void }) {
  const { t } = useLang();
  const [d, setD] = useState<OwnDeviceType>(initial);
  const [error, setError] = useState("");
  const f = d.facet;
  const setF = (patch: Partial<IntercomDeviceTypeFacet>) => setD({ ...d, facet: { ...f, ...patch } });
  const needsKeys = f.kind === "beltpack" || f.kind === "deskstation";

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.manufacturer.trim() || !d.model.trim()) { setError(t.dtErrRequired); return; }
    const clean: IntercomDeviceTypeFacet = { ...f, keys: needsKeys || f.keys ? f.keys : undefined, dectCapacity: f.kind === "antenna" ? f.dectCapacity : undefined };
    const read = readDeviceType(clean);
    if (!read.ok) { setError(read.reason); return; }
    actions.saveOwn({ ...d, manufacturer: d.manufacturer.trim(), model: d.model.trim(), sourceUrl: d.sourceUrl?.trim() || undefined, description: d.description?.trim() || undefined, facet: read.facet });
    onDone();
  }

  return (
    <form className="dtForm" onSubmit={save}>
      <div className="dtGrid">
        <label className="libField"><span>{t.dtManufacturer} *</span>
          <input className="textInput" value={d.manufacturer} onChange={(e) => setD({ ...d, manufacturer: e.target.value })} /></label>
        <label className="libField"><span>{t.dtModel} *</span>
          <input className="textInput" value={d.model} onChange={(e) => setD({ ...d, model: e.target.value })} /></label>
        <label className="libField libFieldWide"><span>{t.dtSource}</span>
          <input className="textInput" type="url" placeholder="https://" value={d.sourceUrl ?? ""} onChange={(e) => setD({ ...d, sourceUrl: e.target.value })} /></label>
        <label className="libField libFieldWide"><span>{t.dtDescription}</span>
          <input className="textInput" value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
        <label className="libField"><span>{t.dtKind}</span>
          <select className="textInput" value={f.kind} onChange={(e) => {
            const kind = e.target.value as DeviceKind;
            setF({ kind, keys: kind === "beltpack" || kind === "deskstation" ? f.keys ?? { pages: 1, perPage: 4 } : f.keys, transports: kind === "antenna" && !f.transports.includes("dect") ? [...f.transports, "dect"] : f.transports });
          }}>
            {DEVICE_KINDS.map((k) => <option key={k} value={k}>{kindLabel(t, k)}</option>)}
          </select></label>
        {needsKeys && (
          <>
            <label className="libField"><span>{t.dtPages}</span>
              <input className="textInput" type="number" min={1} max={32} value={f.keys?.pages ?? 1} onChange={(e) => setF({ keys: { pages: Number(e.target.value), perPage: f.keys?.perPage ?? 4 } })} /></label>
            <label className="libField"><span>{t.dtPerPage}</span>
              <input className="textInput" type="number" min={1} max={64} value={f.keys?.perPage ?? 4} onChange={(e) => setF({ keys: { pages: f.keys?.pages ?? 1, perPage: Number(e.target.value) } })} /></label>
          </>
        )}
        {f.kind === "antenna" && (
          <label className="libField"><span>{t.dtDectCapacity}</span>
            <input className="textInput" type="number" min={1} max={1000} value={f.dectCapacity ?? ""} onChange={(e) => setF({ dectCapacity: num(e.target.value) })} /></label>
        )}
        <label className="libField"><span>{t.dtHeadset}</span>
          <input className="textInput" type="number" min={0} max={64} value={f.audio?.headset ?? ""} onChange={(e) => setF({ audio: { ...f.audio, headset: num(e.target.value) } })} /></label>
        <label className="libField"><span>{t.dtLineIn}</span>
          <input className="textInput" type="number" min={0} max={64} value={f.audio?.lineIn ?? ""} onChange={(e) => setF({ audio: { ...f.audio, lineIn: num(e.target.value) } })} /></label>
        <label className="libField"><span>{t.dtLineOut}</span>
          <input className="textInput" type="number" min={0} max={64} value={f.audio?.lineOut ?? ""} onChange={(e) => setF({ audio: { ...f.audio, lineOut: num(e.target.value) } })} /></label>
      </div>

      <fieldset className="dtChecks"><legend>{t.dtTransports}</legend>
        {DEVICE_TRANSPORTS.map((x) => (
          <label key={x}><input type="checkbox" checked={f.transports.includes(x)} onChange={() => setF({ transports: toggle(f.transports, x) })} /> {x}</label>
        ))}
      </fieldset>
      <fieldset className="dtChecks"><legend>{t.dtPower}</legend>
        {POWER_SOURCES.map((x) => (
          <label key={x}><input type="checkbox" checked={!!f.power?.includes(x)} onChange={() => setF({ power: toggle(f.power, x) })} /> {x}</label>
        ))}
      </fieldset>
      <fieldset className="dtChecks"><legend>{t.dtProtocols}</legend>
        {PROTOCOLS.map((x) => (
          <label key={x}><input type="checkbox" checked={!!f.protocols?.includes(x)} onChange={() => setF({ protocols: toggle(f.protocols, x) })} /> {x}</label>
        ))}
        <label><input type="checkbox" checked={!!f.audio?.speaker} onChange={(e) => setF({ audio: { ...f.audio, speaker: e.target.checked } })} /> {t.dtSpeaker}</label>
      </fieldset>

      {error && <p className="libError" role="alert">{error}</p>}
      <div className="libRow">
        <button type="submit" className="btnAccent">{t.dtSave}</button>
        <button type="button" className="btnGhost" onClick={onDone}>{t.libCancel}</button>
      </div>
    </form>
  );
}

function OwnRow({ type, onEdit }: { type: OwnDeviceType; onEdit: () => void }) {
  const { t } = useLang();
  const lib = useDeviceLibrary();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  async function propose() {
    if (!type.sourceUrl) { setNote(t.dtProposeNeedsSource); return; }
    if (lib.phase !== "signed-in") { setNote(t.dtProposeNeedsSignIn); return; }
    setSending(true);
    setNote("");
    try {
      await actions.propose(type);
      setNote(t.dtProposed);
    } catch (e) {
      setNote(e instanceof LibraryError ? libraryErrorText(t, e.code) || e.message : String((e as Error).message ?? e));
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="dtItem">
      <div className="dtItemHead">
        <strong>{type.manufacturer} {type.model}</strong>
        <span className="libDim">{summary(t, type.facet)}</span>
      </div>
      <div className="libRow">
        <button type="button" className="btnSmall" onClick={onEdit}>{t.dtEdit}</button>
        <button type="button" className="btnSmall" disabled={sending} onClick={() => void propose()}>{t.dtPropose}</button>
        <button type="button" className="btnSmall danger" onClick={() => actions.deleteOwn(type.id)}>{t.dtDelete}</button>
      </div>
      {note && <p className="libHint">{note}</p>}
    </li>
  );
}

export function DeviceTypesView() {
  const { t } = useLang();
  const lib = useDeviceLibrary();
  const [editing, setEditing] = useState<OwnDeviceType | null>(null);
  const entries = Object.values(lib.cache.entries).sort((a, b) =>
    `${a.type.manufacturer} ${a.type.model}`.localeCompare(`${b.type.manufacturer} ${b.type.model}`));
  const rejected = Object.values(lib.cache.rejected);

  const copy = (e: IntercomDeviceType) => setEditing({ ...e, id: newId() });

  return (
    <div className="viewPanel">
      <h2>{t.dtTitle}</h2>
      <p className="libHint">{t.dtIntro}</p>

      <div className="softSection">
        <h3>{t.dtOwn}</h3>
        {editing ? (
          <TypeForm initial={editing} onDone={() => setEditing(null)} />
        ) : (
          <button type="button" className="btnSmall" onClick={() => setEditing({ id: newId(), manufacturer: "", model: "", facet: blankFacet() })}>{t.dtNew}</button>
        )}
        {lib.own.length === 0 ? <p className="emptyHint">{t.dtOwnEmpty}</p> : (
          <ul className="dtList">
            {lib.own.map((o) => <OwnRow key={o.id} type={o} onEdit={() => setEditing(o)} />)}
          </ul>
        )}
      </div>

      <div className="softSection">
        <h3>{t.dtLibrary}</h3>
        <div className="libRow">
          <span className="libDim">{t.dtLibraryReadOnly}</span>
          {lib.phase === "signed-in" && (
            <button type="button" className="btnSmall" disabled={lib.busy} onClick={() => void actions.sync()}>{lib.busy ? t.dtSyncing : t.dtSync}</button>
          )}
          {lib.cache.syncedAt && <span className="libDim">{t.dtSyncedAt}: {new Date(lib.cache.syncedAt).toLocaleString()}</span>}
        </div>
        {lib.phase !== "signed-in" && <p className="libHint">{t.dtLibrarySignIn}</p>}
        {lib.error && <p className="libError" role="alert">{libraryErrorText(t, lib.error)}</p>}
        {entries.length === 0 ? <p className="emptyHint">{t.dtLibraryEmpty}</p> : (
          <ul className="dtList">
            {entries.map((e) => (
              <li key={e.slug} className="dtItem">
                <div className="dtItemHead">
                  <strong>{e.type.manufacturer} {e.type.model}</strong>
                  <span className="libDim">{summary(t, e.type.facet)}</span>
                </div>
                <div className="libRow">
                  <span className={`dtStatus dtStatus-${e.status}`}>{statusLabel(t, e.status)}</span>
                  <span className="libDim">{e.confirmations} {t.dtConfirmations}</span>
                  <a href={deviceUrl(lib.server, e.slug)} target="_blank" rel="noreferrer">{t.dtOpen}</a>
                  <button type="button" className="btnSmall" onClick={() => copy(e.type)}>{t.dtCopy}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rejected.length > 0 && (
          <details className="dtRejected">
            <summary>{t.dtRejected}: {rejected.length}</summary>
            <p className="libHint">{t.dtRejectedHint}</p>
            <ul className="dtList">
              {rejected.map((r) => (
                <li key={r.slug} className="dtItem">
                  <strong>{r.manufacturer} {r.model}</strong> <span className="libDim">— {r.reason}</span>{" "}
                  <a href={deviceUrl(lib.server, r.slug)} target="_blank" rel="noreferrer">{t.dtOpen}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
