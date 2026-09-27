import { useEffect, useMemo, useState } from "react";
import type { BeltpackDevice, CoreState, TransportType } from "@broadcast/shared";
import QRCode from "qrcode";
import { useLang } from "../i18n";
import { useDeviceLibrary } from "../lib/deviceLibrary/deviceLibraryStore";
import { deviceRoleOf, type IntercomDeviceType } from "../lib/deviceLibrary/intercomDeviceType";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

interface NetworkHostsResponse {
  ok: boolean;
  hosts: string[];
  serverPort: number;
}

const TRANSPORTS: TransportType[] = ["ethernet", "wifi", "dect"];

function isWebClientDevice(device: BeltpackDevice): boolean {
  return device.transport === "wifi" && device.id.startsWith("web-");
}

// ─── Add hardware device form ─────────────────────────────────────────────────
function AddDeviceForm({ state, api }: { state: CoreState; api: Props["api"] }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [transport, setTransport] = useState<TransportType>("ethernet");
  const [userId, setUserId] = useState("");
  const [typeKey, setTypeKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLang();
  const lib = useDeviceLibrary();

  const users = Object.values(state.users);

  // Own types and the library copy side by side. Only kinds the core runs as
  // a device (beltpack, station) are offered; antennas and interfaces are not
  // a `BeltpackDevice`.
  const types: { key: string; label: string; type: IntercomDeviceType }[] = [
    ...lib.own.map((o) => ({ key: `own:${o.id}`, label: `${o.manufacturer} ${o.model}`, type: o })),
    ...Object.values(lib.cache.entries).map((e) => ({ key: `lib:${e.slug}`, label: `${e.type.manufacturer} ${e.type.model} ↗`, type: e.type })),
  ].filter((x) => deviceRoleOf(x.type.facet));
  const picked = types.find((x) => x.key === typeKey)?.type;

  function pickType(key: string) {
    setTypeKey(key);
    const type = types.find((x) => x.key === key)?.type;
    if (!type) return;
    if (!type.facet.transports.includes(transport)) setTransport(type.facet.transports[0]);
    if (!label.trim()) setLabel(type.model);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimId = id.trim();
    if (!trimId) { setError(t.dmIdRequired); return; }
    setSaving(true);
    setError("");
    try {
      await api("POST", "/api/devices", {
        id: trimId,
        label: label.trim() || trimId,
        transport,
        role: picked ? deviceRoleOf(picked.facet) ?? undefined : undefined,
        userId: userId || undefined,
      });
      setId(""); setLabel(""); setTransport("ethernet"); setUserId(""); setTypeKey("");
      setOpen(false);
    } catch {
      setError(t.dmAddFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dmAddDevice">
      {!open ? (
        <button className="btnPrimary" onClick={() => setOpen(true)}>{t.dmAdd}</button>
      ) : (
        <form className="dmAddForm" onSubmit={e => void submit(e)}>
          <h4 className="dmAddFormTitle">{t.dmAddTitle}</h4>
          {types.length > 0 && (
            <div className="dmEditRow">
              <label>{t.dtPickType}</label>
              <select className="textInput" value={typeKey} onChange={e => pickType(e.target.value)}>
                <option value="">{t.dtPickNone}</option>
                {types.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
          )}
          <div className="dmEditRow">
            <label>{t.dmId}</label>
            <input className="textInput" value={id} onChange={e => setId(e.target.value)} placeholder={t.dmIdPlaceholder} />
          </div>
          <div className="dmEditRow">
            <label>{t.dmLabel}</label>
            <input className="textInput" value={label} onChange={e => setLabel(e.target.value)} placeholder={t.dmLabelPlaceholder} />
          </div>
          <div className="dmEditRow">
            <label>{t.dmTransport}</label>
            <select className="textInput" value={transport} onChange={e => setTransport(e.target.value as TransportType)}>
              {(picked ? picked.facet.transports : TRANSPORTS).map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="dmEditRow">
            <label>{t.dmUser}</label>
            <select className="textInput" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">{t.dmUnassigned}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {error && <p className="dmAddError">{error}</p>}
          <div className="dmEditActions">
            <button className="btnPrimary" type="submit" disabled={saving}>{saving ? "…" : t.dmAddBtn}</button>
            <button className="btnGhost" type="button" onClick={() => { setOpen(false); setError(""); }}>{t.dmCancel}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function QrImage({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 160, margin: 1 }).then((d: string) => { if (active) setSrc(d); }).catch(() => {});
    return () => { active = false; };
  }, [url]);
  return src ? <img src={src} alt={label} className="webClientQrImage" /> : <div className="webClientQrPlaceholder">QR…</div>;
}

// ─── Hardware device accordion (full edit form) ───────────────────────────────
function HardwareAccordion({ device, state, api }: {
  device: BeltpackDevice;
  state: CoreState;
  api: Props["api"];
}) {
  const { t } = useLang();
  const users = Object.values(state.users);
  const channels = Object.values(state.channels);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(device.label);
  const [editChannels, setEditChannels] = useState(device.channelIds);
  const [editListens, setEditListens] = useState(device.listenChannelIds);
  const [editTranscriptions, setEditTranscriptions] = useState(device.transcriptionChannelIds || []);
  const [editUserId, setEditUserId] = useState(device.userId || "");
  const [editTransport, setEditTransport] = useState<TransportType>(device.transport);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function startEdit() {
    setEditLabel(device.label); setEditChannels(device.channelIds);
    setEditListens(device.listenChannelIds); setEditTranscriptions(device.transcriptionChannelIds || []);
    setEditUserId(device.userId || ""); setEditTransport(device.transport);
    setEditing(true); setOpen(true);
  }

  async function save() {
    await api("PATCH", `/api/devices/${device.id}`, {
      label: editLabel, channelIds: editChannels, listenChannelIds: editListens,
      transcriptionChannelIds: editTranscriptions, transport: editTransport, userId: editUserId || null,
    });
    setEditing(false);
  }

  async function remove() {
    if (!confirm(t.dmRemoveConfirm.replace("{label}", device.label))) return;
    await api("DELETE", `/api/devices/${device.id}`);
  }

  const user = device.userId ? state.users[device.userId] : null;

  return (
    <div className={`dmAccordion ${open ? "open" : ""}`}>
      <div className="dmAccordionHeader" onClick={() => !editing && setOpen(v => !v)}>
        <span className="dmDot eth" />
        <strong className="dmLabel">{device.label}</strong>
        {user && <span className="dmUser dim">👤 {user.name}</span>}
        <span className="dmChannels dim">📡 {device.channelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</span>
        <div className="dmActions" onClick={e => e.stopPropagation()}>
          <button className="btnSmall" onClick={startEdit}>{t.dmEdit}</button>
          <button className="btnSmall danger" onClick={() => void remove()}>{t.dmRemove}</button>
        </div>
        <span className="dmChevron">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="dmAccordionBody">
          {editing ? (
            <div className="dmEditForm">
              <div className="dmEditRow">
                <label>{t.dmName}</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="textInput" />
              </div>
              <div className="dmEditRow">
                <label>{t.dmUser}</label>
                <select value={editUserId} onChange={e => setEditUserId(e.target.value)} className="textInput">
                  <option value="">{t.dmUnassigned}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="dmEditRow">
                <label>{t.dmTransport}</label>
                <select value={editTransport} onChange={e => setEditTransport(e.target.value as TransportType)} className="textInput">
                  {TRANSPORTS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="dmChannelGrid">
                {(["talk", "listen", "transcribe"] as const).map(kind => {
                  const list = kind === "talk" ? editChannels : kind === "listen" ? editListens : editTranscriptions;
                  const setList = kind === "talk" ? setEditChannels : kind === "listen" ? setEditListens : setEditTranscriptions;
                  const lbl = kind === "talk" ? t.dmTalk : kind === "listen" ? t.dmListen : t.dmTranscription;
                  return (
                    <div key={kind} className="dmChannelCol">
                      <p className="dmChannelColLabel">{lbl}</p>
                      {channels.map(ch => (
                        <label key={ch.id} className="dmCheckLabel">
                          <input type="checkbox" checked={list.includes(ch.id)} onChange={() => toggle(list, setList, ch.id)} />
                          {ch.name}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="dmEditActions">
                <button className="btnPrimary" onClick={() => void save()}>{t.dmSave}</button>
                <button className="btnGhost" onClick={() => setEditing(false)}>{t.dmCancel}</button>
              </div>
            </div>
          ) : (
            <div className="dmDetails">
              <span>{t.dmTalk}: <strong>{device.channelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
              <span>{t.dmListen}: <strong>{device.listenChannelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
              <span>{t.dmTranscription}: <strong>{(device.transcriptionChannelIds || []).map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
              <span className="dim" style={{ fontSize: 11 }}>ID: {device.id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Web client status row (read-only — beltpack configures itself) ───────────
function WebClientRow({ device, state, api }: {
  device: BeltpackDevice;
  state: CoreState;
  api: Props["api"];
}) {
  const { t } = useLang();
  const user = device.userId ? state.users[device.userId] : null;
  const online = Boolean(state.presence?.[device.id]?.online);

  async function remove() {
    if (!confirm(t.dmRemoveFromListConfirm.replace("{label}", device.label))) return;
    await api("DELETE", `/api/devices/${device.id}`);
  }

  async function revoke() {
    if (!confirm(t.dmRevokeConfirm.replace("{label}", device.label))) return;
    await api("POST", `/api/devices/${device.id}/revoke`);
  }

  return (
    <div className="dmWebRow">
      <span className={`onlineDot ${online ? "on" : "off"}`} title={online ? t.dmConnected : t.dmDisconnected} />
      <strong className="dmLabel">{device.label}</strong>
      {user && <span className="dmUser dim">👤 {user.name}</span>}
      <span className="dmChannels dim">📡 {device.channelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</span>
      <div className="dmActions">
        <button className="btnSmall danger" onClick={() => void remove()} title={t.dmRemoveFromListTip}>{t.dmRemove}</button>
        <button className="btnSmall danger" onClick={() => void revoke()} title={t.dmRevokeTip}>{t.dmRevoke}</button>
      </div>
    </div>
  );
}

export function DeviceManager({ state, api }: Props) {
  const { t } = useLang();
  const devices = Object.values(state.devices);
  const [lanHosts, setLanHosts] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteHost = useMemo(() => {
    const h = window.location.hostname;
    if (h && h !== "localhost" && h !== "127.0.0.1") return h;
    return selectedHost || lanHosts[0] || null;
  }, [lanHosts, selectedHost]);

  const inviteUrl = useMemo(() => {
    if (!inviteHost) return null;
    const url = new URL(window.location.href);
    url.hostname = inviteHost;
    url.search = "";
    url.searchParams.set("mode", "client");
    return url.toString();
  }, [inviteHost]);

  useEffect(() => {
    api<NetworkHostsResponse>("GET", "/api/network/hosts").then(r => {
      if (r.ok) {
        setLanHosts(r.hosts || []);
        if (!selectedHost && (r.hosts || []).length === 1) setSelectedHost(r.hosts[0]);
      }
    }).catch(() => {});
  }, []);

  function copyInvite() {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const webClients = devices.filter(isWebClientDevice);
  const hardwareDevices = devices.filter(d => !isWebClientDevice(d));

  return (
    <div className="viewPanel dmPanel">
      <h2>{t.dmTitle}</h2>

      {/* Hardware devices */}
      <section className="dmSection">
        <h3 className="dmSectionTitle">{t.dmHardware}</h3>
        {hardwareDevices.map(d => (
          <HardwareAccordion key={d.id} device={d} state={state} api={api} />
        ))}
        <AddDeviceForm state={state} api={api} />
      </section>

      {/* Browser beltpacks */}
      <section className="dmSection">
        <h3 className="dmSectionTitle">{t.dmBrowserTitle}</h3>
        <p className="dmSectionDesc">
          {t.dmBrowserDesc}
        </p>

        {/* Invite link box */}
        <div className="dmInviteBox">
          {lanHosts.length > 1 && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
            <div className="dmHostSelect">
              <label className="dim">{t.dmWlan}</label>
              <select value={selectedHost} onChange={e => setSelectedHost(e.target.value)} className="textInput" style={{ width: "auto" }}>
                {lanHosts.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
          {inviteUrl ? (
            <div className="dmInviteContent">
              <QrImage url={inviteUrl} label={t.dmQrAlt} />
              <div className="dmInviteRight">
                <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>{t.dmQrTitle}</p>
                <p className="dim" style={{ fontSize: 12, margin: "0 0 8px" }}>
                  {t.dmQrDesc}
                </p>
                <div className="wcModalLinkRow">
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="wcModalLink">{inviteUrl}</a>
                  <button className={`wcCopyBtn ${copied ? "copied" : ""}`} onClick={copyInvite}>
                    {copied ? t.dmCopied : t.dmCopy}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="dim" style={{ fontSize: 12 }}>
              ⚠ {t.dmNoQr}
            </p>
          )}
        </div>

        {/* Connected beltpacks list */}
        {webClients.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="dim" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{t.dmRegistered}</p>
            {webClients.map(d => (
              <WebClientRow key={d.id} device={d} state={state} api={api} />
            ))}
          </div>
        )}

        {(state.revokedDeviceIds ?? []).length > 0 && (
          <div className="dmRevoked">
            <p className="dmRevokedTitle">{t.dmRevokedTitle}</p>
            {(state.revokedDeviceIds ?? []).map((id) => (
              <div key={id} className="dmWebRow">
                <strong className="dmLabel">{id}</strong>
                <div className="dmActions">
                  <button className="btnSmall" onClick={() => void api("DELETE", `/api/devices/${id}/revoke`)}>{t.dmRestore}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
