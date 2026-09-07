import { useCallback, useEffect, useRef, useState } from "react";
import type { CoreState } from "@broadcast/shared";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import type { AudioChunkPayload } from "../hooks/useIntercomStore";
import { downsampleToInt16, int16ToBase64, mikrofonPegel } from "../lib/audio";

type PttMode = "momentary" | "latching";
const TRANSCRIPTION_SAMPLE_RATE = 16000;

interface Prefs {
  inputDevice: string;
  outputDevice: string;
  masterVolume: number;
  pttMode: PttMode;
  voxEnabled: boolean;
  voxThreshold: number;
  channelVolumes: Record<string, number>;
  listenChannels: string[];
  transcriptionChannels: string[];
  compressionEnabled: boolean;
  compressorThreshold: number;
  compressorRatio: number;
  limiterEnabled: boolean;
  limiterThreshold: number;
  vstBridgeEnabled: boolean;
  vstBridgeHost: string;
  vstPluginPaths: string;
}

function loadPrefs(): Prefs {
  try { return { ...JSON.parse(localStorage.getItem("softclientPrefs") || "{}") }; }
  catch { return {} as Prefs; }
}

interface Props {
  state: CoreState;
  sendWs: (msg: unknown) => void;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
  setAudioChunkHandler: (fn: ((p: AudioChunkPayload) => void) | null) => void;
}

export function Softclient({ state, sendWs, api, setAudioChunkHandler }: Props) {
  const clientId = useRef(localStorage.getItem("clientId") || `web-${Math.random().toString(36).slice(2, 8)}`);
  const p = loadPrefs();

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDevice, setInputDevice] = useState(p.inputDevice || "");
  const [outputDevice, setOutputDevice] = useState(p.outputDevice || "");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const animRef = useRef<number>(0);

  const [masterVolume, setMasterVolume] = useState(p.masterVolume ?? 80);
  const [pttMode, setPttMode] = useState<PttMode>(p.pttMode || "momentary");
  const [voxEnabled, setVoxEnabled] = useState(p.voxEnabled || false);
  const [voxThreshold, setVoxThreshold] = useState(p.voxThreshold ?? 20);
  const [compressionEnabled, setCompressionEnabled] = useState(p.compressionEnabled ?? true);
  const [compressorThreshold, setCompressorThreshold] = useState(p.compressorThreshold ?? -24);
  const [compressorRatio, setCompressorRatio] = useState(p.compressorRatio ?? 4);
  const [limiterEnabled, setLimiterEnabled] = useState(p.limiterEnabled ?? true);
  const [limiterThreshold, setLimiterThreshold] = useState(p.limiterThreshold ?? -3);
  const [vstBridgeEnabled, setVstBridgeEnabled] = useState(p.vstBridgeEnabled ?? state.pluginBridge.enabled);
  const [vstBridgeHost, setVstBridgeHost] = useState(p.vstBridgeHost || state.pluginBridge.host || "ws://127.0.0.1:39000");
  const [vstPluginPaths, setVstPluginPaths] = useState(p.vstPluginPaths || (state.pluginBridge.pluginPaths || []).join("\n"));
  const [savingBridge, setSavingBridge] = useState(false);

  const [talkChannels, setTalkChannels] = useState<Set<string>>(new Set());
  const [listenChannels, setListenChannels] = useState<Set<string>>(new Set(p.listenChannels || []));
  const [transcriptionChannels, setTranscriptionChannels] = useState<Set<string>>(new Set(p.transcriptionChannels || []));
  const [channelVolumes, setChannelVolumes] = useState<Record<string, number>>(p.channelVolumes || {});
  const [alertChannels, setAlertChannels] = useState<Set<string>>(new Set());
  const [activeChannel, setActiveChannel] = useState<string>("");

  useAudioPlayback(setAudioChunkHandler, listenChannels);

  // Refs for use inside animation-frame callback
  const voxRef = useRef({ enabled: false, threshold: 20, isTalking: false });
  const listenRef = useRef<Set<string>>(listenChannels);
  const transcriptionRef = useRef<Set<string>>(transcriptionChannels);

  const channels = Object.values(state.channels);
  const activeSpeakersByChannel = new Map<string, string[]>();
  Object.values(state.devices).forEach((device) => {
    if (!device.talkChannelId) return;
    const current = activeSpeakersByChannel.get(device.talkChannelId) || [];
    current.push(device.label);
    activeSpeakersByChannel.set(device.talkChannelId, current);
  });
  const transcriptEvents = state.events.filter((e) => e.type === "transcript").slice(0, 8);

  useEffect(() => { localStorage.setItem("clientId", clientId.current); }, []);
  useEffect(() => {
    if (channels.length === 0) return;
    sendWs({
      type: "register_device",
      payload: {
        id: clientId.current,
        label: `Web ${clientId.current}`,
        role: "beltpack",
        transport: "wifi",
        channelIds: channels.map((c) => c.id),
      },
    });
  }, [channels, sendWs]);
  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels[0].id);
    }
  }, [activeChannel, channels]);

  // Persist prefs
  useEffect(() => {
    const prefs: Prefs = {
      inputDevice, outputDevice, masterVolume, pttMode,
      voxEnabled, voxThreshold, channelVolumes,
      listenChannels: Array.from(listenChannels),
      transcriptionChannels: Array.from(transcriptionChannels),
      compressionEnabled,
      compressorThreshold,
      compressorRatio,
      limiterEnabled,
      limiterThreshold,
      vstBridgeEnabled,
      vstBridgeHost,
      vstPluginPaths,
    };
    localStorage.setItem("softclientPrefs", JSON.stringify(prefs));
  }, [inputDevice, outputDevice, masterVolume, pttMode, voxEnabled, voxThreshold, channelVolumes, listenChannels, transcriptionChannels, compressionEnabled, compressorThreshold, compressorRatio, limiterEnabled, limiterThreshold, vstBridgeEnabled, vstBridgeHost, vstPluginPaths]);

  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = compressionEnabled ? compressorThreshold : 0;
      compressorRef.current.ratio.value = compressionEnabled ? compressorRatio : 1;
      compressorRef.current.knee.value = 30;
      compressorRef.current.attack.value = 0.003;
      compressorRef.current.release.value = 0.2;
    }
    if (limiterRef.current) {
      limiterRef.current.threshold.value = limiterEnabled ? limiterThreshold : 0;
      limiterRef.current.ratio.value = limiterEnabled ? 20 : 1;
      limiterRef.current.knee.value = 0;
      limiterRef.current.attack.value = 0.001;
      limiterRef.current.release.value = 0.08;
    }
  }, [compressionEnabled, compressorThreshold, compressorRatio, limiterEnabled, limiterThreshold]);

  // Keep vox ref in sync
  useEffect(() => { voxRef.current.enabled = voxEnabled; voxRef.current.threshold = voxThreshold; }, [voxEnabled, voxThreshold]);
  useEffect(() => { listenRef.current = listenChannels; }, [listenChannels]);
  useEffect(() => { transcriptionRef.current = transcriptionChannels; }, [transcriptionChannels]);
  useEffect(() => {
    sendWs({
      type: "set_transcription_channels",
      payload: { id: clientId.current, channelIds: Array.from(transcriptionChannels) },
    });
  }, [transcriptionChannels, sendWs]);

  const doSetTalk = useCallback((channelId: string, active: boolean) => {
    sendWs({ type: "set_talk", payload: { id: clientId.current, channelId, active } });
  }, [sendWs]);

  const doSetListen = useCallback((channels: Set<string>) => {
    sendWs({ type: "set_listen", payload: { id: clientId.current, channelIds: Array.from(channels) } });
  }, [sendWs]);

  async function requestAudio() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: inputDevice ? { deviceId: { exact: inputDevice } } : true,
      });
      setStream(s);
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(s);
      const compressor = ctx.createDynamicsCompressor();
      const limiter = ctx.createDynamicsCompressor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(analyser);
      compressorRef.current = compressor;
      limiterRef.current = limiter;
      analyserRef.current = analyser;

      const mute = ctx.createGain();
      mute.gain.value = 0;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      limiter.connect(mute);
      mute.connect(processor);
      processor.connect(ctx.destination);
      muteRef.current = mute;
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        const selectedChannels = Array.from(transcriptionRef.current);
        if (selectedChannels.length === 0) return;

        const raw = event.inputBuffer.getChannelData(0);
        const pcm = downsampleToInt16(raw, ctx.sampleRate, TRANSCRIPTION_SAMPLE_RATE);
        if (pcm.length === 0) return;
        const audio = int16ToBase64(pcm);

        selectedChannels.forEach((channelId) => {
          sendWs({
            type: "transcribe_audio",
            payload: {
              id: clientId.current,
              channelId,
              sampleRate: TRANSCRIPTION_SAMPLE_RATE,
              audio,
            },
          });
        });
      };

      const tick = () => {
        // Zeitbereich, nicht Spektrum: hier stand ein Mittel ueber alle
        // FFT-Bins, und das ist bei Sprache systematisch zu niedrig. Der
        // PhoneClient rechnete schon immer richtig; jetzt tun es beide durch
        // dieselbe Funktion. Siehe `lib/audio.ts`.
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        const pct = mikrofonPegel(data);
        setMicLevel(pct);

        // VOX logic
        if (voxRef.current.enabled) {
          const above = pct > voxRef.current.threshold;
          if (above && !voxRef.current.isTalking) {
            voxRef.current.isTalking = true;
            listenRef.current.forEach((chId) =>
              sendWs({ type: "set_talk", payload: { id: clientId.current, channelId: chId, active: true } })
            );
            setTalkChannels(new Set(listenRef.current));
          } else if (!above && voxRef.current.isTalking) {
            voxRef.current.isTalking = false;
            listenRef.current.forEach((chId) =>
              sendWs({ type: "set_talk", payload: { id: clientId.current, channelId: chId, active: false } })
            );
            setTalkChannels(new Set());
          }
        }
        animRef.current = requestAnimationFrame(tick);
      };
      tick();

      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput"));
    } catch {
      alert("Microphone access denied");
    }
  }

  function stopAudio() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (muteRef.current) {
      muteRef.current.disconnect();
      muteRef.current = null;
    }
    if (compressorRef.current) {
      compressorRef.current.disconnect();
      compressorRef.current = null;
    }
    if (limiterRef.current) {
      limiterRef.current.disconnect();
      limiterRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
    setMicLevel(0);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    releaseAll();
  }

  function startTalk(channelId: string) {
    if (pttMode === "latching") {
      setTalkChannels((prev) => {
        const next = new Set(prev);
        if (next.has(channelId)) { next.delete(channelId); doSetTalk(channelId, false); }
        else { next.add(channelId); doSetTalk(channelId, true); }
        return next;
      });
    } else {
      setTalkChannels((prev) => {
        if (prev.has(channelId)) return prev;
        const next = new Set(prev);
        next.add(channelId);
        doSetTalk(channelId, true);
        return next;
      });
    }
  }

  function stopTalk(channelId: string) {
    if (pttMode === "latching") return;
    setTalkChannels((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      doSetTalk(channelId, false);
      return next;
    });
  }

  function releaseAll() {
    setTalkChannels((prev) => {
      prev.forEach((chId) => doSetTalk(chId, false));
      return new Set();
    });
  }

  function pageAll() {
    const all = new Set(channels.map((ch) => ch.id));
    all.forEach((chId) => { if (!talkChannels.has(chId)) doSetTalk(chId, true); });
    setTalkChannels(all);
  }

  function toggleListen(channelId: string) {
    setListenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      doSetListen(next);
      return next;
    });
  }

  function toggleTranscriptionChannel(channelId: string) {
    setTranscriptionChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  function setChannelVol(channelId: string, vol: number) {
    setChannelVolumes((prev) => ({ ...prev, [channelId]: vol }));
  }

  async function savePluginBridge() {
    setSavingBridge(true);
    try {
      const pluginPaths = vstPluginPaths
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      await api("PATCH", "/api/audio/plugin-bridge", {
        enabled: vstBridgeEnabled,
        protocol: vstBridgeHost.startsWith("http") ? "http" : "ws",
        host: vstBridgeHost,
        pluginPaths,
        bypass: !vstBridgeEnabled,
      });
    } finally {
      setSavingBridge(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space" && activeChannel && !e.repeat) {
        e.preventDefault();
        startTalk(activeChannel);
      }
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (idx < channels.length) setActiveChannel(channels[idx].id);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && activeChannel) {
        e.preventDefault();
        stopTalk(activeChannel);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel, channels.length, pttMode]);

  // Call alerts from event log
  useEffect(() => {
    const callEvs = state.events.filter((e) => e.type === "call");
    if (callEvs.length === 0) return;
    callEvs.slice(0, 3).forEach((ev) => {
      const ch = channels.find((c) => ev.message.includes(c.name));
      if (!ch) return;
      setAlertChannels((prev) => new Set([...prev, ch.id]));
      setTimeout(() => setAlertChannels((prev) => { const n = new Set(prev); n.delete(ch.id); return n; }), 4000);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events.length]);

  const micColor = micLevel > 80 ? "var(--danger)" : micLevel > 50 ? "var(--warning)" : "var(--success)";

  return (
    <div className="viewPanel softclientPanel">
      <div className="softclientHeader">
        <h2>Web Client Settings</h2>
        <code className="clientIdBadge">{clientId.current}</code>
        <button onClick={() => window.open(`${window.location.origin}?mode=client`, "_blank", "noopener,noreferrer")}>Open Web Client</button>
      </div>

      {/* ── Audio setup ── */}
      <section className="softSection">
        <h3>Audio</h3>
        <div className="softAudioRow">
          {!stream
            ? <button onClick={requestAudio}>Enable microphone</button>
            : <button className="btnDanger" onClick={stopAudio}>Release microphone</button>
          }
          {stream && (
            <div className="micMeter">
              <span>Mic</span>
              <div className="meterTrack">
                <div className="meterFill" style={{ width: `${micLevel}%`, background: micColor }} />
              </div>
              <span>{micLevel}%</span>
            </div>
          )}
        </div>
        {audioDevices.length > 0 && (
          <div className="deviceSelects">
            <label>Input
              <select value={inputDevice} onChange={(e) => setInputDevice(e.target.value)}>
                <option value="">Default</option>
                {audioDevices.filter((d) => d.kind === "audioinput").map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                ))}
              </select>
            </label>
            <label>Output
              <select value={outputDevice} onChange={(e) => setOutputDevice(e.target.value)}>
                <option value="">Default</option>
                {audioDevices.filter((d) => d.kind === "audiooutput").map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                ))}
              </select>
            </label>
            <label>Master vol
              <input type="range" min={0} max={100} value={masterVolume}
                onChange={(e) => setMasterVolume(+e.target.value)} />
              <span>{masterVolume}%</span>
            </label>
          </div>
        )}
      </section>

      {/* ── Settings ── */}
      <section className="softSection">
        <h3>Settings</h3>
        <div className="settingsRow">
          <label>PTT Mode
            <select value={pttMode} onChange={(e) => setPttMode(e.target.value as PttMode)}>
              <option value="momentary">Momentary (hold)</option>
              <option value="latching">Latching (toggle)</option>
            </select>
          </label>
          <label className="checkLabel">
            <input type="checkbox" checked={voxEnabled} onChange={(e) => setVoxEnabled(e.target.checked)} />
            VOX (auto-talk on listened channels)
          </label>
          {voxEnabled && (
            <label>VOX threshold
              <input type="range" min={0} max={100} value={voxThreshold}
                onChange={(e) => setVoxThreshold(+e.target.value)} />
              <span>{voxThreshold}%</span>
            </label>
          )}
        </div>
        <p className="softHint">⌨ Space = PTT on active channel · 1–9 = select channel</p>
        <p className="softHint">📝 Vosk transcribes only channels selected per strip while mic is enabled.</p>
      </section>

      <section className="softSection">
        <h3>Mic Processing</h3>
        <div className="settingsRow">
          <label className="checkLabel">
            <input type="checkbox" checked={compressionEnabled} onChange={(e) => setCompressionEnabled(e.target.checked)} />
            Compressor
          </label>
          <label>
            Threshold
            <input type="range" min={-60} max={0} value={compressorThreshold} onChange={(e) => setCompressorThreshold(+e.target.value)} />
            <span>{compressorThreshold} dB</span>
          </label>
          <label>
            Ratio
            <input type="range" min={1} max={12} value={compressorRatio} onChange={(e) => setCompressorRatio(+e.target.value)} />
            <span>{compressorRatio}:1</span>
          </label>
        </div>
        <div className="settingsRow">
          <label className="checkLabel">
            <input type="checkbox" checked={limiterEnabled} onChange={(e) => setLimiterEnabled(e.target.checked)} />
            Limiter
          </label>
          <label>
            Ceiling
            <input type="range" min={-12} max={0} value={limiterThreshold} onChange={(e) => setLimiterThreshold(+e.target.value)} />
            <span>{limiterThreshold} dB</span>
          </label>
        </div>
      </section>

      <section className="softSection">
        <h3>VST Bridge (Interface)</h3>
        <div className="settingsRow">
          <label className="checkLabel">
            <input type="checkbox" checked={vstBridgeEnabled} onChange={(e) => setVstBridgeEnabled(e.target.checked)} />
            Enable external plugin host bridge
          </label>
        </div>
        <div className="deviceSelects">
          <label>Bridge host
            <input value={vstBridgeHost} onChange={(e) => setVstBridgeHost(e.target.value)} placeholder="ws://127.0.0.1:39000" />
          </label>
        </div>
        <label className="vstPathLabel">Plugin paths (one per line)
          <textarea value={vstPluginPaths} onChange={(e) => setVstPluginPaths(e.target.value)} rows={4} />
        </label>
        <div className="settingsRow">
          <button onClick={savePluginBridge} disabled={savingBridge}>{savingBridge ? "Saving..." : "Save plugin bridge"}</button>
        </div>
        <p className="softHint">This is a host interface only. Actual VST processing runs in an external plugin host process.</p>
      </section>

      {/* ── Channel strip ── */}
      <section className="softSection">
        <div className="softChHeader">
          <h3>Channels</h3>
          <div className="softChActions">
            <button className="btnPage" onClick={pageAll} title="Broadcast to ALL channels">
              📢 Page All
            </button>
            {talkChannels.size > 0 && (
              <button className="btnRelease" onClick={releaseAll} title="Release all active talks">
                ✕ Unlatch All ({talkChannels.size})
              </button>
            )}
          </div>
        </div>

        <div className="channelStrips">
          {channels.length === 0 && <p className="softHint">No channels configured.</p>}
          {channels.map((ch, idx) => {
            const isTalking = talkChannels.has(ch.id);
            const isListening = listenChannels.has(ch.id);
            const isTranscribed = transcriptionChannels.has(ch.id);
            const isAlert = alertChannels.has(ch.id);
            const isActive = activeChannel === ch.id;
            const activeSpeakers = activeSpeakersByChannel.get(ch.id) || [];
            const isNetworkLive = activeSpeakers.length > 0;
            const vol = channelVolumes[ch.id] ?? 80;
            const speakerPreview = activeSpeakers.slice(0, 2).join(", ");
            const speakerOverflow = activeSpeakers.length > 2 ? ` +${activeSpeakers.length - 2}` : "";

            return (
              <div
                key={ch.id}
                className={`channelStrip ${isTalking ? "stripTalking" : ""} ${isNetworkLive ? "stripNetworkLive" : ""} ${isAlert ? "stripAlert" : ""} ${isActive ? "stripActive" : ""}`}
                style={{ borderLeft: `4px solid ${ch.color}` }}
                onClick={() => setActiveChannel(ch.id)}
              >
                <span className="stripIndex">{idx < 9 ? idx + 1 : "—"}</span>
                <span className="stripName">{ch.name}</span>

                <span className={`tallyDot ${isTalking || isNetworkLive ? "tallyLive" : ""}`} title={isTalking || isNetworkLive ? "ON AIR" : "Off"} />

                {isNetworkLive && <span className="liveInfo">Live: {speakerPreview}{speakerOverflow}</span>}

                <button
                  className={`pttBtn ${isTalking ? "pttActive" : ""}`}
                  onMouseDown={(e) => { e.stopPropagation(); startTalk(ch.id); }}
                  onMouseUp={(e) => { e.stopPropagation(); stopTalk(ch.id); }}
                  onMouseLeave={() => stopTalk(ch.id)}
                  onTouchStart={(e) => { e.stopPropagation(); startTalk(ch.id); }}
                  onTouchEnd={(e) => { e.stopPropagation(); stopTalk(ch.id); }}
                  title={pttMode === "momentary" ? "Hold to talk" : "Click to toggle talk"}
                >
                  {isTalking ? "🔴 LIVE" : "🎙 PTT"}
                </button>

                <label className="listenToggle" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isListening} onChange={() => toggleListen(ch.id)} />
                  Listen
                </label>

                <label className="listenToggle" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isTranscribed} onChange={() => toggleTranscriptionChannel(ch.id)} />
                  Transcribe
                </label>

                {isListening && (
                  <label className="chVolLabel" onClick={(e) => e.stopPropagation()}>
                    <input type="range" min={0} max={100} value={vol}
                      onChange={(e) => setChannelVol(ch.id, +e.target.value)} />
                    <span>{vol}%</span>
                  </label>
                )}

                {isAlert && <span className="callAlert">📞 CALL</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="softSection">
        <h3>Live Transcript</h3>
        <div className="transcriptLog">
          {transcriptEvents.map((e) => (
            <div className="transcriptItem" key={e.id}>
              <span className="transcriptTime">{new Date(e.ts).toLocaleTimeString()}</span>
              <span>{e.message}</span>
            </div>
          ))}
          {transcriptEvents.length === 0 && <p className="softHint">No transcript lines yet.</p>}
        </div>
      </section>
    </div>
  );
}
