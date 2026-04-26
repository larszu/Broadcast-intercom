import { useState } from "react";
import type { ConfigRef, CoreState } from "@broadcast/shared";

interface Props {
  onEnter: (state: CoreState) => void;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

export function StartScreen({ onEnter, api }: Props) {
  const [configs, setConfigs] = useState<ConfigRef[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const res = await api<{ active: string; items: ConfigRef[] }>("GET", "/api/configs");
    setConfigs(res.items || []);
    setLoaded(true);
  }

  async function createNew() {
    const name = newName.trim() || "default";
    const res = await api<{ ok: boolean; state: CoreState }>("POST", "/api/configs/new", { name });
    if (res.ok) {
      onEnter(res.state);
    }
  }

  async function loadConfig(name: string) {
    try {
      const res = await api<{ ok: boolean; state: CoreState; error?: string }>("POST", "/api/configs/load", { name });
      if (res.ok) {
        onEnter(res.state);
      } else {
        setError(res.error || "Load failed");
      }
    } catch {
      setError("Could not reach server");
    }
  }

  return (
    <div className="startScreen">
      <div className="startCard">
        <h1>Broadcast Intercom</h1>
        <p>Browser-based intercom host for wired and web clients</p>

        <div className="startSection">
          <h2>New configuration</h2>
          <div className="row">
            <input
              type="text"
              placeholder="Show name, e.g. main-event"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNew()}
            />
            <button onClick={createNew}>Create</button>
          </div>
        </div>

        <div className="startSection">
          <div className="row">
            <h2>Open existing</h2>
            <button onClick={refresh}>Browse</button>
          </div>
          {loaded && configs.length === 0 && <p>No saved configs found</p>}
          {loaded && configs.length > 0 && (
            <ul className="configList">
              {configs.map((c) => (
                <li key={c.name} onClick={() => loadConfig(c.name)}>
                  <strong>{c.name}</strong>
                  <span>{new Date(c.updatedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="errorText">{error}</p>}
        </div>
      </div>
    </div>
  );
}
