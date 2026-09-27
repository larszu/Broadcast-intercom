import { useState } from "react";
import type { Channel, CoreState } from "@broadcast/shared";
import { useLang } from "../i18n";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

const COLORS = ["#c1121f", "#0077b6", "#2a9d8f", "#f4a261", "#7b2d8b", "#e9c46a", "#e76f51", "#264653"];

export function ChannelManager({ state, api }: Props) {
  const { t } = useLang();
  const channels = Object.values(state.channels);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  async function createChannel() {
    if (!name.trim()) return;
    await api("POST", "/api/channels", { name: name.trim(), color });
    setName("");
    setColor(COLORS[0]);
  }

  async function saveEdit(id: string) {
    await api("PATCH", `/api/channels/${id}`, { name: editName, color: editColor });
    setEditId(null);
  }

  async function deleteChannel(id: string) {
    if (!confirm(t.chDeleteConfirm.replace("{name}", state.channels[id]?.name ?? id))) return;
    await api("DELETE", `/api/channels/${id}`);
  }

  return (
    <div className="viewPanel">
      <h2>{t.chTitle}</h2>

      <div className="channelGrid">
        {channels.map((ch: Channel) => (
          <div key={ch.id} className="channelItem" style={{ borderColor: ch.color }}>
            {editId === ch.id ? (
              <>
                <input title={t.chNamePlaceholder} value={editName} onChange={(e) => setEditName(e.target.value)} />
                <div className="colorRow">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={c}
                      title={c}
                      className={editColor === c ? "colorDot selected" : "colorDot"}
                      style={{ background: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
                <div className="actionRow">
                  <button onClick={() => saveEdit(ch.id)}>{t.chSaveBtn}</button>
                  <button onClick={() => setEditId(null)}>{t.chCancelBtn}</button>
                </div>
              </>
            ) : (
              <>
                <span className="chBadge" style={{ background: ch.color }}>{ch.name}</span>
                <small>{ch.id}</small>
                <div className="actionRow">
                  <button onClick={() => { setEditId(ch.id); setEditName(ch.name); setEditColor(ch.color); }}>{t.chEditBtn}</button>
                  <button onClick={() => deleteChannel(ch.id)}>{t.chDeleteBtn}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h3>{t.chAddTitle}</h3>
      <div className="addRow">
        <input placeholder={t.chNamePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="colorRow">
          {COLORS.map((c) => (
            <button
              key={c}
              className={color === c ? "colorDot selected" : "colorDot"}
              aria-label={c}
              title={c}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button onClick={createChannel}>{t.chAddBtn}</button>
      </div>
    </div>
  );
}
