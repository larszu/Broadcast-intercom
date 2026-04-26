import { useEffect, useMemo, useState } from "react";
import type { CoreState, EventItem } from "@broadcast/shared";
import { useLang } from "../i18n";

const DE_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip";
const EN_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
  compact?: boolean;
}

interface TranscriptionStatus {
  ok: boolean;
  installed: boolean;
  modelPath: string;
  moduleLoaded: boolean;
  disabledReason: string | null;
  defaultModelUrl: string;
}

interface ParsedEntry {
  id: string;
  ts: number;
  channel: string;
  sender: string;
  text: string;
}

/** Parse "[Channel] Sender: text" format emitted by server */
function parseTranscript(e: EventItem): ParsedEntry | null {
  const m = e.message.match(/^\[([^\]]+)\]\s+(.+?):\s+(.+)$/);
  if (!m) return null;
  return { id: e.id, ts: e.ts, channel: m[1], sender: m[2], text: m[3] };
}

function getModelLang(): "en" | "de" {
  return (localStorage.getItem("transcriptModelLang") as "en" | "de" | null) ?? "en";
}

function SenderAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div className="chatAvatar" style={{ background: `hsl(${hue}, 55%, 36%)` }}>
      {initials || "?"}
    </div>
  );
}

export function TranscriptView({ state, api, compact = false }: Props) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<TranscriptionStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [modelLang, setModelLangState] = useState<"en" | "de">(getModelLang);

  const channelList = Object.values(state.channels);

  function setModelLang(l: "en" | "de") {
    setModelLangState(l);
    localStorage.setItem("transcriptModelLang", l);
  }

  async function refreshStatus() {
    try {
      const next = await api<TranscriptionStatus>("GET", "/api/transcription/status");
      setStatus(next);
    } catch { /* ignore */ }
  }

  useEffect(() => { void refreshStatus(); }, []);

  async function installModel() {
    setInstalling(true);
    try {
      const url = modelLang === "de" ? DE_MODEL_URL : EN_MODEL_URL;
      await api("POST", "/api/transcription/model/install", { url, force: true });
      await refreshStatus();
    } finally {
      setInstalling(false);
    }
  }

  function toggleChannel(name: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const entries = useMemo((): ParsedEntry[] => {
    return state.events
      .filter((e: EventItem) => e.type === "transcript")
      .map(parseTranscript)
      .filter((x): x is ParsedEntry => x !== null)
      .filter((e) => {
        const textOk = query.trim() === "" || e.text.toLowerCase().includes(query.toLowerCase());
        const chOk = selectedChannels.size === 0 || selectedChannels.has(e.channel);
        return textOk && chOk;
      })
      .sort((a, b) => a.ts - b.ts); // oldest first → chat flow
  }, [state.events, query, selectedChannels]);

  if (compact) {
    return (
      <div className="chatLog compactChat">
        {entries.length === 0 && <p className="chatEmpty">{t.transcriptChatEmpty}</p>}
        {entries.map((e) => (
          <div key={e.id} className="chatBubble">
            <SenderAvatar name={e.sender} />
            <div className="chatBubbleBody">
              <div className="chatMeta">
                <span className="chatSender">{e.sender}</span>
                <span className="chatChannel">{e.channel}</span>
                <span className="chatTime">{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
              <div className="chatText">{e.text}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="viewPanel transcriptPanel">
      <div className="transcriptHeader">
        <h2>{t.transcriptTitle}</h2>
      </div>

      {/* Model status + language selector */}
      <div className="transcriptStatusCard">
        <div className="transcriptLangRow">
          <span className="transcriptLangLabel">{t.transcriptLangTitle}</span>
          <label>
            <input type="radio" name="modelLang" value="en" checked={modelLang === "en"} onChange={() => setModelLang("en")} />
            {" "}{t.transcriptLangEn}
          </label>
          <label>
            <input type="radio" name="modelLang" value="de" checked={modelLang === "de"} onChange={() => setModelLang("de")} />
            {" "}{t.transcriptLangDe}
          </label>
        </div>
        <p className="transcriptLangHint">{t.transcriptLangHint}</p>
        <div className="transcriptModelRow">
          <span>{status?.installed ? "✅ Model installed" : "⚠️ Model not installed"}</span>
          {status?.modelPath && <span className="dim">{status.modelPath}</span>}
          {status?.disabledReason && <span className="statusWarn">{status.disabledReason}</span>}
          <button onClick={() => void installModel()} disabled={installing} className="btnSmall">
            {installing ? t.transcriptInstalling : t.transcriptInstallBtn}
          </button>
        </div>
      </div>

      {/* Channel filter chips */}
      {channelList.length > 0 && (
        <div className="transcriptChannelFilters">
          {channelList.map((ch) => (
            <button
              key={ch.id}
              className={`chFilterChip ${selectedChannels.has(ch.name) ? "active" : ""}`}
              onClick={() => toggleChannel(ch.name)}
            >
              {ch.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="transcriptFilters">
        <input
          placeholder="Search transcripts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="searchInput"
        />
      </div>

      {/* Chat log */}
      <div className="chatLog">
        {entries.length === 0 && <p className="chatEmpty">{t.transcriptChatEmpty}</p>}
        {entries.map((e) => (
          <div key={e.id} className="chatBubble">
            <SenderAvatar name={e.sender} />
            <div className="chatBubbleBody">
              <div className="chatMeta">
                <span className="chatSender">{e.sender}</span>
                <span className="chatChannel">{e.channel}</span>
                <span className="chatTime">{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
              <div className="chatText">{e.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
