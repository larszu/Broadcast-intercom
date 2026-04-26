import { useState } from "react";
import type { Channel, CoreState } from "@broadcast/shared";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

const COLORS = ["#c1121f", "#0077b6", "#2a9d8f", "#f4a261", "#7b2d8b", "#e9c46a", "#e76f51", "#264653"];

export function ChannelManager({ state, api }: Props) {
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
    if (!confirm(`Delete channel ${state.channels[id]?.name}?`)) return;
    await api("DELETE", `/api/channels/${id}`);
  }

  return (
    <div className="viewPanel">
      <h2>Channels</h2>

      <div className="channelGrid">
        {channels.map((ch: Channel) => (
          <div key={ch.id} className="channelItem" style={{ borderColor: ch.color }}>
            {editId === ch.id ? (
              <>
                <input title="Channel name" value={editName} onChange={(e) => setEditName(e.target.value)} />
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
                  <button onClick={() => saveEdit(ch.id)}>Save</button>
                  <button onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <span className="chBadge" style={{ background: ch.color }}>{ch.name}</span>
                <small>{ch.id}</small>
                <div className="actionRow">
                  <button onClick={() => { setEditId(ch.id); setEditName(ch.name); setEditColor(ch.color); }}>Edit</button>
                  <button onClick={() => deleteChannel(ch.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h3>Add channel</h3>
      <div className="addRow">
        <input placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} />
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
        <button onClick={createChannel}>Add</button>
      </div>
    </div>
  );
}
