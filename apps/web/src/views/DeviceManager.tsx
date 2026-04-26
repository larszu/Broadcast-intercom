import { useEffect, useMemo, useState } from "react";
import type { BeltpackDevice, CoreState, TransportType } from "@broadcast/shared";
import QRCode from "qrcode";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

interface NetworkHostsResponse {
  ok: boolean;
  hosts: string[];
  serverPort: number;
}

const TRANSPORTS: TransportType[] = ["ethernet", "wifi"];

function isWebClientDevice(device: BeltpackDevice): boolean {
  return device.transport === "wifi" && device.id.startsWith("web-");
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
    if (!confirm(`Gerät "${device.label}" entfernen?`)) return;
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
          <button className="btnSmall" onClick={startEdit}>Bearbeiten</button>
          <button className="btnSmall danger" onClick={() => void remove()}>Entfernen</button>
        </div>
        <span className="dmChevron">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="dmAccordionBody">
          {editing ? (
            <div className="dmEditForm">
              <div className="dmEditRow">
                <label>Name</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="textInput" />
              </div>
              <div className="dmEditRow">
                <label>Benutzer</label>
                <select value={editUserId} onChange={e => setEditUserId(e.target.value)} className="textInput">
                  <option value="">Nicht zugewiesen</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="dmEditRow">
                <label>Transport</label>
                <select value={editTransport} onChange={e => setEditTransport(e.target.value as TransportType)} className="textInput">
                  {TRANSPORTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="dmChannelGrid">
                {(["talk", "listen", "transcribe"] as const).map(kind => {
                  const list = kind === "talk" ? editChannels : kind === "listen" ? editListens : editTranscriptions;
                  const setList = kind === "talk" ? setEditChannels : kind === "listen" ? setEditListens : setEditTranscriptions;
                  const lbl = kind === "talk" ? "Sprechen" : kind === "listen" ? "Mithören" : "Transkription";
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
                <button className="btnPrimary" onClick={() => void save()}>Speichern</button>
                <button className="btnGhost" onClick={() => setEditing(false)}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <div className="dmDetails">
              <span>Sprechen: <strong>{device.channelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
              <span>Mithören: <strong>{device.listenChannelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
              <span>Transkription: <strong>{(device.transcriptionChannelIds || []).map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</strong></span>
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
  const user = device.userId ? state.users[device.userId] : null;
  const online = Boolean(state.presence?.[device.id]?.online);

  async function remove() {
    if (!confirm(`"${device.label}" aus der Liste entfernen?`)) return;
    await api("DELETE", `/api/devices/${device.id}`);
  }

  return (
    <div className="dmWebRow">
      <span className={`onlineDot ${online ? "on" : "off"}`} title={online ? "Verbunden" : "Nicht verbunden"} />
      <strong className="dmLabel">{device.label}</strong>
      {user && <span className="dmUser dim">👤 {user.name}</span>}
      <span className="dmChannels dim">📡 {device.channelIds.map(id => state.channels[id]?.name ?? id).join(", ") || "—"}</span>
      <div className="dmActions">
        <button className="btnSmall danger" onClick={() => void remove()} title="Aus der Geräteliste entfernen">Entfernen</button>
      </div>
    </div>
  );
}

export function DeviceManager({ state, api }: Props) {
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
      <h2>Geräte</h2>

      {/* Hardware devices */}
      {hardwareDevices.length > 0 && (
        <section className="dmSection">
          <h3 className="dmSectionTitle">Hardware-Geräte</h3>
          {hardwareDevices.map(d => (
            <HardwareAccordion key={d.id} device={d} state={state} api={api} />
          ))}
        </section>
      )}

      {/* Browser beltpacks */}
      <section className="dmSection">
        <h3 className="dmSectionTitle">Browser-Beltpacks</h3>
        <p className="dmSectionDesc">
          Ein Handy, Tablet oder PC-Tab wird zum Beltpack wenn es diesen Link öffnet. Name, Benutzer und Kanäle stellt jedes Beltpack direkt bei sich selbst ein.
        </p>

        {/* Invite link box */}
        <div className="dmInviteBox">
          {lanHosts.length > 1 && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
            <div className="dmHostSelect">
              <label className="dim">WLAN-Adresse:</label>
              <select value={selectedHost} onChange={e => setSelectedHost(e.target.value)} className="textInput" style={{ width: "auto" }}>
                {lanHosts.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
          {inviteUrl ? (
            <div className="dmInviteContent">
              <QrImage url={inviteUrl} label="Browser-Beltpack öffnen" />
              <div className="dmInviteRight">
                <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>QR-Code scannen oder Link teilen</p>
                <p className="dim" style={{ fontSize: 12, margin: "0 0 8px" }}>
                  Jedes Gerät das diesen Link öffnet wird ein unabhängiges Beltpack. Einstellungen (Name, Kanäle, Benutzer) macht jedes Beltpack selbst.
                </p>
                <div className="wcModalLinkRow">
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="wcModalLink">{inviteUrl}</a>
                  <button className={`wcCopyBtn ${copied ? "copied" : ""}`} onClick={copyInvite}>
                    {copied ? "Kopiert!" : "Kopieren"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="dim" style={{ fontSize: 12 }}>
              ⚠ Kein QR — öffne diese Seite über die LAN-IP (z.B. https://192.168.x.x:5173) damit der Link für andere Geräte im Netzwerk erreichbar ist.
            </p>
          )}
        </div>

        {/* Connected beltpacks list */}
        {webClients.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="dim" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Registrierte Beltpacks</p>
            {webClients.map(d => (
              <WebClientRow key={d.id} device={d} state={state} api={api} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
