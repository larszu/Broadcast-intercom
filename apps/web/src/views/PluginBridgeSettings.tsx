import { useEffect, useState } from "react";
import { useLang } from "../i18n";

interface PluginBridgeConfig {
  enabled: boolean;
  protocol: "ws" | "http";
  host: string;
  pluginPaths: string[];
  preset?: string;
  bypass: boolean;
}

interface FsEntry {
  name: string;
  isDir: boolean;
  path: string;
}

interface FsListResponse {
  ok: boolean;
  path: string;
  entries: FsEntry[];
  parent: string | null;
}

interface Props {
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

function FileBrowserModal({ onSelect, onClose, api }: {
  onSelect: (path: string) => void;
  onClose: () => void;
  api: Props["api"];
}) {
  const [listing, setListing] = useState<FsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualPath, setManualPath] = useState("");

  async function loadPath(p?: string) {
    setLoading(true);
    try {
      const url = p ? `/api/fs/list?path=${encodeURIComponent(p)}` : "/api/fs/list";
      const result = await api<FsListResponse>("GET", url);
      setListing(result);
      setManualPath(result.path);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPath(); }, []);

  function navigate(e: FsEntry) {
    if (e.isDir) void loadPath(e.path);
    else onSelect(e.path);
  }

  return (
    <div className="wcModalOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wcModal" style={{ maxWidth: 520 }}>
        <div className="wcModalHeader">
          <span className="wcModalTitle">Plugin-Datei auswählen</span>
          <button className="btnGhost wcModalClose" onClick={onClose}>✕</button>
        </div>
        <div className="wcModalBody" style={{ gap: 8 }}>
          {/* Manual path entry + navigate */}
          <div className="wcModalLinkRow">
            <input
              className="wcModalLink"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 12 }}
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void loadPath(manualPath); }}
              placeholder="Pfad eingeben…"
            />
            <button className="wcCopyBtn" onClick={() => void loadPath(manualPath)}>Navigieren</button>
          </div>

          {/* Up button */}
          {listing?.parent && (
            <button className="btnSmall" onClick={() => void loadPath(listing.parent!)}>↑ Übergeordnet</button>
          )}

          {/* Directory listing */}
          <div className="fbListing">
            {loading && <p className="dim">Lädt…</p>}
            {!loading && listing?.entries.length === 0 && <p className="dim">Leer</p>}
            {!loading && listing?.entries.map((e) => (
              <div
                key={e.path}
                className={`fbEntry ${e.isDir ? "dir" : "file"}`}
                onClick={() => navigate(e)}
              >
                <span className="fbEntryIcon">{e.isDir ? "📁" : "🎛"}</span>
                <span className="fbEntryName">{e.name}</span>
                {!e.isDir && <span className="fbEntryAdd" onClick={(ev) => { ev.stopPropagation(); onSelect(e.path); }}>+ Hinzufügen</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="wcModalFooter">
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

export function PluginBridgeSettings({ api }: Props) {
  const { t } = useLang();
  const [config, setConfig] = useState<PluginBridgeConfig>({
    enabled: false,
    protocol: "ws",
    host: "ws://127.0.0.1:39000",
    pluginPaths: [],
    preset: "",
    bypass: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);

  useEffect(() => {
    api<{ ok: boolean; pluginBridge: PluginBridgeConfig }>("GET", "/api/audio/plugin-bridge")
      .then(({ pluginBridge }) => setConfig(pluginBridge))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(next: PluginBridgeConfig) {
    await api("PATCH", "/api/audio/plugin-bridge", next);
    setConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addPath(p: string) {
    if (!config.pluginPaths.includes(p)) {
      void save({ ...config, pluginPaths: [...config.pluginPaths, p] });
    }
    setShowBrowser(false);
  }

  function removePath(p: string) {
    void save({ ...config, pluginPaths: config.pluginPaths.filter((x) => x !== p) });
  }

  if (loading) return <div className="softSection"><p className="dim">Lädt…</p></div>;

  return (
    <>
      <div className="softSection pluginBridgeSection">
        <h3>{t.pluginTitle}</h3>

        <div className="settingsRow">
          <label className="toggleRow">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => void save({ ...config, enabled: e.target.checked })}
            />
            {t.pluginEnabled}
          </label>
        </div>

        <div className="settingsRow">
          <label>{t.pluginProtocol}</label>
          <div className="radioGroup">
            {(["ws", "http"] as const).map((p) => (
              <label key={p}>
                <input
                  type="radio"
                  name="pluginProtocol"
                  value={p}
                  checked={config.protocol === p}
                  onChange={() => void save({ ...config, protocol: p })}
                />
                {" "}{p === "ws" ? "WebSocket (ws://)" : "HTTP"}
              </label>
            ))}
          </div>
        </div>

        <div className="settingsRow">
          <label>{t.pluginHost}</label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => setConfig({ ...config, host: e.target.value })}
            onBlur={() => void save(config)}
            className="textInput"
            placeholder="ws://127.0.0.1:39000"
          />
        </div>

        <div className="settingsRow">
          <label className="toggleRow">
            <input
              type="checkbox"
              checked={config.bypass}
              onChange={(e) => void save({ ...config, bypass: e.target.checked })}
            />
            {t.pluginBypass}
          </label>
        </div>

        <div className="settingsRow" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <label>{t.pluginPaths}</label>
            <button className="btnSmall" onClick={() => setShowBrowser(true)}>+ Durchsuchen…</button>
          </div>
          {config.pluginPaths.length === 0 && (
            <p className="dim" style={{ fontSize: 12 }}>Noch keine Plugin-Pfade hinzugefügt.</p>
          )}
          <div className="pluginPathList">
            {config.pluginPaths.map((p) => (
              <div key={p} className="pluginPathRow">
                <span className="pluginPathText" title={p}>🎛 {p}</span>
                <button className="btnSmall danger" onClick={() => removePath(p)}>×</button>
              </div>
            ))}
          </div>
        </div>

        {saved && <p className="dim" style={{ fontSize: 12 }}>✓ {t.pluginSaved}</p>}
      </div>

      {showBrowser && (
        <FileBrowserModal
          api={api}
          onSelect={addPath}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  );
}
