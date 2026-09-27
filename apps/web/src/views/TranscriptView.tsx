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
  bookmark?: boolean;
}

/** Parse "[Channel] Sender: text" format emitted by server */
function parseTranscript(e: EventItem): ParsedEntry | null {
  const m = e.message.match(/^\[([^\]]+)\]\s+(.+?):\s+(.+)$/);
  if (!m) return null;
  return { id: e.id, ts: e.ts, channel: m[1], sender: m[2], text: m[3] };
}

function parseBookmark(e: EventItem): ParsedEntry {
  return { id: e.id, ts: e.ts, channel: "", sender: "", text: e.message, bookmark: true };
}

function readPinned(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("transcriptPinned") ?? "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
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

function Bubble({ e, bookmarkLabel, pinned = false }: { e: ParsedEntry; bookmarkLabel: string; pinned?: boolean }) {
  return (
    <div className={`chatBubble${e.bookmark ? " bookmark" : ""}${pinned ? " pinned" : ""}`}>
      {e.bookmark ? <div className="chatAvatar bookmarkMark">★</div> : <SenderAvatar name={e.sender} />}
      <div className="chatBubbleBody">
        <div className="chatMeta">
          <span className="chatSender">{e.bookmark ? bookmarkLabel : e.sender}</span>
          {!e.bookmark && <span className="chatChannel">{e.channel}</span>}
          <span className="chatTime">{new Date(e.ts).toLocaleTimeString()}</span>
        </div>
        <div className="chatText">{e.text}</div>
      </div>
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
  const [note, setNote] = useState("");
  // Pinned channels come first in the filter and their lines stand out. Kept
  // per browser: it is how this operator reads, not part of the show.
  const [pinned, setPinned] = useState<Set<string>>(readPinned);
  // When each channel was last on screen. A line that arrives while its
  // channel is filtered out counts as unread until the channel is shown.
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

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

  async function addBookmark() {
    await api("POST", "/api/transcript/bookmark", { note });
    setNote("");
  }

  async function clearTranscript() {
    if (!window.confirm(t.transcriptClearConfirm)) return;
    await api("DELETE", "/api/transcript");
  }

  // One selected channel narrows the export too; several or none export all.
  const exportChannelId =
    selectedChannels.size === 1 ? channelList.find((c) => selectedChannels.has(c.name))?.id : undefined;
  const exportHref = (format: string) =>
    `/api/transcript?format=${format}${exportChannelId ? `&channel=${encodeURIComponent(exportChannelId)}` : ""}`;

  function togglePin(name: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      try { localStorage.setItem("transcriptPinned", JSON.stringify([...next])); } catch { /* private mode */ }
      return next;
    });
  }

  const isVisible = (name: string) => selectedChannels.size === 0 || selectedChannels.has(name);

  const allLines = useMemo(
    () => state.events
      .filter((e: EventItem) => e.type === "transcript")
      .map(parseTranscript)
      .filter((x): x is ParsedEntry => x !== null),
    [state.events],
  );

  useEffect(() => {
    const stamp = Date.now();
    setLastSeen((prev) => {
      const next = { ...prev };
      for (const ch of channelList) if (isVisible(ch.name)) next[ch.name] = stamp;
      return next;
    });
  }, [allLines, selectedChannels]);

  const unread = (name: string) =>
    isVisible(name) ? 0 : allLines.filter((e) => e.channel === name && e.ts > (lastSeen[name] ?? 0)).length;

  const orderedChannels = [...channelList].sort((a, b) => Number(pinned.has(b.name)) - Number(pinned.has(a.name)));

  function toggleChannel(name: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const entries = useMemo((): ParsedEntry[] => {
    return state.events
      .map((e: EventItem) => (e.type === "transcript" ? parseTranscript(e) : e.type === "bookmark" ? parseBookmark(e) : null))
      .filter((x): x is ParsedEntry => x !== null)
      .filter((e) => {
        const textOk = query.trim() === "" || e.text.toLowerCase().includes(query.toLowerCase());
        const chOk = e.bookmark || selectedChannels.size === 0 || selectedChannels.has(e.channel);
        return textOk && chOk;
      })
      .sort((a, b) => a.ts - b.ts); // oldest first → chat flow
  }, [state.events, query, selectedChannels]);

  if (compact) {
    return (
      <div className="chatLog compactChat">
        {entries.length === 0 && <p className="chatEmpty">{t.transcriptChatEmpty}</p>}
        {entries.map((e) => <Bubble key={e.id} e={e} bookmarkLabel={t.transcriptBookmarkLabel} pinned={pinned.has(e.channel)} />)}
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
          <span>{status?.installed ? `✅ ${t.transcriptModelInstalled}` : `⚠️ ${t.transcriptModelMissing}`}</span>
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
          {orderedChannels.map((ch) => {
            const n = unread(ch.name);
            return (
              <span key={ch.id} className="chFilterGroup">
                <button
                  className={`chFilterChip ${selectedChannels.has(ch.name) ? "active" : ""}`}
                  onClick={() => toggleChannel(ch.name)}
                >
                  {ch.name}
                  {n > 0 && <span className="unreadBadge" aria-label={t.transcriptUnread.replace("{n}", String(n))}>{n}</span>}
                </button>
                <button
                  className={`chPinBtn ${pinned.has(ch.name) ? "pinOn" : ""}`}
                  aria-pressed={pinned.has(ch.name)}
                  title={pinned.has(ch.name) ? t.transcriptUnpin : t.transcriptPin}
                  aria-label={pinned.has(ch.name) ? t.transcriptUnpin : t.transcriptPin}
                  onClick={() => togglePin(ch.name)}
                >
                  ★
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="transcriptFilters">
        <input
          placeholder={t.transcriptSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="searchInput"
        />
      </div>

      {/* Bookmarks and export */}
      <div className="transcriptActions">
        <input
          className="searchInput"
          placeholder={t.transcriptBookmarkPlaceholder}
          aria-label={t.transcriptBookmarkPlaceholder}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void addBookmark(); }}
        />
        <button className="btnSmall" onClick={() => void addBookmark()}>{t.transcriptBookmarkBtn}</button>
        <span className="transcriptExportLabel">{t.transcriptExport}</span>
        <a className="btnSmall" href={exportHref("txt")} download>TXT</a>
        <a className="btnSmall" href={exportHref("srt")} download>SRT</a>
        <a className="btnSmall" href={exportHref("json")} download>JSON</a>
        <button className="btnSmall" onClick={() => void clearTranscript()}>{t.transcriptClear}</button>
      </div>

      {/* Chat log */}
      <div className="chatLog">
        {entries.length === 0 && <p className="chatEmpty">{t.transcriptChatEmpty}</p>}
        {entries.map((e) => <Bubble key={e.id} e={e} bookmarkLabel={t.transcriptBookmarkLabel} pinned={pinned.has(e.channel)} />)}
      </div>
    </div>
  );
}
