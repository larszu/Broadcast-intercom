import { useEffect, useMemo, useRef, useState } from "react";
import type { CoreState } from "@broadcast/shared";
import { useLang } from "../i18n";
import { PttSlider } from "./PttSlider";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import type { AudioChunkPayload } from "../hooks/useIntercomStore";
import { downsampleToInt16, int16ToBase64, mikrofonPegel } from "../lib/audio";

const TRANSCRIPTION_SAMPLE_RATE = 16000;

function describeMicError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = String(error.name);
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Mikrofonzugriff wurde im Browser blockiert. Erlaube das Mikrofon in der Browser-Leiste und tippe danach erneut auf den Button.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Es wurde kein Mikrofon gefunden.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Das Mikrofon wird bereits von einer anderen App oder einem anderen Tab verwendet.";
    }
    if (name === "SecurityError") {
      return "Der Browser blockiert das Mikrofon in diesem Kontext. Auf dem Handy brauchst du HTTPS oder localhost.";
    }
  }

  return "Mikrofonzugriff konnte nicht gestartet werden.";
}

interface Props {
  state: CoreState;
  sendWs: (msg: unknown) => void;
  connected: boolean;
  setAudioChunkHandler: (fn: ((p: AudioChunkPayload) => void) | null) => void;
}

export function PhoneClient({ state, sendWs, connected, setAudioChunkHandler }: Props) {
  const { t } = useLang();
  const searchParams = new URLSearchParams(window.location.search);
  const forcedClientId = searchParams.get("deviceId")?.trim() || "";
  const forcedLabel = searchParams.get("label")?.trim() || "";
  const forcedUserId = searchParams.get("userId")?.trim() || "";
  const clientId = useRef(forcedClientId || localStorage.getItem("webClientId") || `web-${Math.random().toString(36).slice(2, 8)}`);

  // Setup screen state
  const [setupDone, setSetupDone] = useState(
    Boolean(forcedLabel || forcedClientId || localStorage.getItem("webClientLabel"))
  );
  const [setupName, setSetupName] = useState("");
  const [setupUserId, setSetupUserId] = useState(forcedUserId || localStorage.getItem("webClientUserId") || "");
  const [resolvedLabel, setResolvedLabel] = useState(
    forcedLabel || localStorage.getItem("webClientLabel") || ""
  );
  const [resolvedUserId, setResolvedUserId] = useState(
    forcedUserId || localStorage.getItem("webClientUserId") || ""
  );
  const clientLabel = useMemo(
    () => resolvedLabel || `Web Client ${clientId.current.slice(-4)}`,
    [resolvedLabel]
  );
  const channels = useMemo(() => Object.values(state.channels), [state.channels]);
  const myDevice = state.devices[clientId.current];
  const availableChannelIds = myDevice?.channelIds || channels.map((ch) => ch.id);
  const availableChannels = channels.filter((ch) => availableChannelIds.includes(ch.id));
  const myUser = myDevice?.userId ? state.users[myDevice.userId] : undefined;
  const [activeChannel, setActiveChannel] = useState("");
  const [talking, setTalking] = useState(false);
  const [listenChannels, setListenChannels] = useState<Set<string>>(new Set());
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDevice, setInputDevice] = useState("");
  const [outputDevice, setOutputDevice] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState("");
  const [permissionState, setPermissionState] = useState("prompt");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const animRef = useRef<number>(0);
  const activeChannelRef = useRef(activeChannel);
  const lastRegisteredKeyRef = useRef("");
  const isSecureContext = typeof window !== "undefined" && Boolean(window.isSecureContext);

  const outputSelectionSupported = typeof HTMLMediaElement !== "undefined"
    && "setSinkId" in HTMLMediaElement.prototype;

  useAudioPlayback(setAudioChunkHandler, listenChannels);

  useEffect(() => {
    if (!forcedClientId) {
      localStorage.setItem("webClientId", clientId.current);
    }
  }, [forcedClientId]);

  useEffect(() => {
    if (!activeChannel && availableChannels.length > 0) {
      setActiveChannel(availableChannels[0].id);
      return;
    }

    if (activeChannel && !availableChannelIds.includes(activeChannel)) {
      setActiveChannel(availableChannels[0]?.id || "");
    }
  }, [activeChannel, availableChannels, availableChannelIds]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    console.log(`[PhoneClient] Active channel changed to: ${activeChannel || "(none)"}. Device ID: ${clientId.current}`);
    if (!activeChannel) {
      sendWs({ type: "set_transcription_channels", payload: { id: clientId.current, channelIds: [] } });
      return;
    }
    sendWs({ type: "set_transcription_channels", payload: { id: clientId.current, channelIds: [activeChannel] } });
  }, [activeChannel, sendWs]);

  useEffect(() => {
    let mounted = true;
    let permissionStatus: PermissionStatus | null = null;

    async function syncPermissionState() {
      if (!navigator.permissions?.query) {
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (!mounted) {
          return;
        }
        setPermissionState(permissionStatus.state);
        permissionStatus.onchange = () => {
          if (mounted) {
            setPermissionState(permissionStatus?.state || "prompt");
          }
        };
      } catch {
        // Permissions API is not available consistently on mobile browsers.
      }
    }

    syncPermissionState();
    return () => {
      mounted = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) {
      return;
    }

    async function refreshAudioDevices() {
      try {
        const devices = await mediaDevices.enumerateDevices();
        if (!devices.length) {
          return;
        }
        setAudioDevices(devices.filter((device) => device.kind === "audioinput" || device.kind === "audiooutput"));
      } catch {
        // Ignore browser-specific enumerateDevices failures.
      }
    }

    void refreshAudioDevices();
    mediaDevices.addEventListener?.("devicechange", refreshAudioDevices);
    return () => {
      mediaDevices.removeEventListener?.("devicechange", refreshAudioDevices);
    };
  }, []);

  useEffect(() => {
    if (channels.length === 0) return;
    const channelIds = channels.map((ch) => ch.id).sort();
    // Deduplicate: only re-register when params actually change
    const key = `${channelIds.join(",")}|${clientLabel}|${resolvedUserId}`;
    if (lastRegisteredKeyRef.current === key) return;
    lastRegisteredKeyRef.current = key;
    console.log(`[PhoneClient.register] Registering device: id=${clientId.current}, label=${clientLabel}, channels=${channelIds.join(",")}`);
    sendWs({
      type: "register_device",
      payload: {
        id: clientId.current,
        label: clientLabel,
        role: "beltpack",
        transport: "wifi",
        userId: resolvedUserId || undefined,
        channelIds,
      },
    });

    if (resolvedUserId) {
      sendWs({ type: "set_user", payload: { id: clientId.current, userId: resolvedUserId } });
    }
  }, [channels, clientLabel, resolvedUserId, sendWs]);

  useEffect(() => {
    const listen = myDevice?.listenChannelIds || [];
    setListenChannels(new Set(listen));
  }, [myDevice?.listenChannelIds]);

  // Only stop the stream tracks when the stream reference changes.
  // Node cleanup (analyser, processor, mute, audioCtx) is handled exclusively by
  // releaseAudio() which runs synchronously before any new nodes are created.
  // Doing node cleanup here causes a race: the cleanup fires AFTER requestAudio()
  // has already written new nodes into the refs, disconnecting the new graph.
  useEffect(() => {
    const capturedStream = stream;
    return () => {
      capturedStream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  async function requestAudio(deviceId = inputDevice) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Dieser Browser stellt auf dieser URL keinen Mikrofonzugriff bereit. Das ist haeufig bei normalem HTTP statt HTTPS der Fall, ausser auf localhost.");
      return false;
    }

    try {
      console.log(`[PhoneClient.requestAudio] Requesting microphone access (deviceId=${deviceId || "default"})...`);
      setMicError("");
      if (stream) {
        releaseAudio();
      }
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      console.log("[PhoneClient.requestAudio] Microphone granted! Setting up AudioContext...");
      setStream(nextStream);
      setPermissionState("granted");
      const selectedTrack = nextStream.getAudioTracks()[0];
      const settings = selectedTrack?.getSettings();
      if (settings?.deviceId) {
        setInputDevice(settings.deviceId);
      }

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      // iOS Safari suspends AudioContext until user gesture; resume it explicitly
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const source = ctx.createMediaStreamSource(nextStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      // Analyser gets its own pull path to destination so it works independently of the processor.
      source.connect(analyser);
      analyser.connect(mute);
      mute.connect(ctx.destination);

      // Processor connects directly to source for transcription audio.
      source.connect(processor);
      processor.connect(ctx.destination);

      analyserRef.current = analyser;
      muteRef.current = mute;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const channelId = activeChannelRef.current;
        if (!channelId) {
          console.warn("[PhoneClient.processor] No active channel set – audio dropped. Did you click a channel?");
          return;
        }

        const raw = event.inputBuffer.getChannelData(0);
        const pcm = downsampleToInt16(raw, ctx.sampleRate, TRANSCRIPTION_SAMPLE_RATE);
        if (pcm.length === 0) {
          console.warn("[PhoneClient.processor] Empty PCM buffer – audio dropped");
          return;
        }

        const payload = {
          id: clientId.current,
          channelId,
          sampleRate: TRANSCRIPTION_SAMPLE_RATE,
          audio: int16ToBase64(pcm),
        };

        try {
          sendWs({
            type: "transcribe_audio",
            payload,
          });
          console.debug(`[PhoneClient.processor] Sent audio: ${pcm.length} samples (~${Math.round((payload.audio.length / 1024))} KB base64) to channel ${channelId}`);
        } catch (err) {
          console.error(`[PhoneClient.processor] Failed to send transcribe_audio:`, err);
          setMicError(`Fehler beim Audioversand: ${err instanceof Error ? err.message : "Unbekannt"}`);
        }
      };

      const tick = () => {
        // Zeitbereichs-RMS, jetzt aus `lib/audio.ts` — dieselbe Rechnung wie
        // im Softclient, damit derselbe Balken auch dasselbe bedeutet.
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        setMicLevel(mikrofonPegel(data));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter((device) => device.kind === "audioinput" || device.kind === "audiooutput"));
      } catch {
        // Ignore enumerateDevices failures after permission grant.
      }
      return true;
    } catch (error) {
      setPermissionState("denied");
      setMicError(describeMicError(error));
      return false;
    }
  }

  function releaseAudio() {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
    processorRef.current?.disconnect();
    muteRef.current?.disconnect();
    analyserRef.current?.disconnect();
    processorRef.current = null;
    muteRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setMicLevel(0);
  }

  async function handleInputDeviceChange(deviceId: string) {
    setInputDevice(deviceId);
    if (stream) {
      await requestAudio(deviceId);
    }
  }

  function handleOutputDeviceChange(deviceId: string) {
    setOutputDevice(deviceId);
  }

  function setTalk(active: boolean) {
    if (!activeChannel) return;
    sendWs({ type: "set_talk", payload: { id: clientId.current, channelId: activeChannel, active } });
    setTalking(active);
  }

  async function beginTalk() {
    if (!stream) {
      const started = await requestAudio();
      if (!started) {
        return;
      }
    }
    setTalk(true);
  }

  function endTalk() {
    setTalk(false);
  }

  function toggleListen(channelId: string) {
    setListenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      sendWs({ type: "set_listen", payload: { id: clientId.current, channelIds: Array.from(next) } });
      return next;
    });
  }

  const activeSpeakersByChannel = new Map<string, string[]>();
  Object.values(state.devices).forEach((device) => {
    if (!device.talkChannelId) return;
    const list = activeSpeakersByChannel.get(device.talkChannelId) || [];
    list.push(device.label);
    activeSpeakersByChannel.set(device.talkChannelId, list);
  });

  // Setup screen – shown when no name has been configured yet
  if (!setupDone) {
    const users = Object.values(state.users);
    const handleSetupConfirm = () => {
      const name = setupName.trim() || `Web Client ${clientId.current.slice(-4)}`;
      localStorage.setItem("webClientLabel", name);
      if (setupUserId) {
        localStorage.setItem("webClientUserId", setupUserId);
      } else {
        localStorage.removeItem("webClientUserId");
      }
      setResolvedLabel(name);
      setResolvedUserId(setupUserId);
      // Reset registration key so it re-registers with new name
      lastRegisteredKeyRef.current = "";
      setSetupDone(true);
    };
    return (
      <div className="phoneSetupWrap">
        <div className="phoneSetupCard">
          <h1>{t.setupTitle}</h1>
          <p>{t.setupSubtitle}</p>
          <label className="phoneSetupLabel">
            {t.setupDeviceName}
            <input
              className="phoneSetupInput"
              type="text"
              placeholder={`Web Client ${clientId.current.slice(-4)}`}
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetupConfirm()}
              autoFocus
            />
          </label>
          {users.length > 0 && (
            <label className="phoneSetupLabel">
              {t.setupUser}
              <select
                className="phoneSetupInput"
                value={setupUserId}
                onChange={(e) => setSetupUserId(e.target.value)}
              >
                <option value="">{t.setupNoUser}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </label>
          )}
          {users.length === 0 && connected && (
            <p className="phoneSetupHint">{t.setupNoUsersHint}</p>
          )}
          {!connected && (
            <p className="phoneSetupHint">{t.setupConnecting}</p>
          )}
          <button className="phoneSetupBtn" onClick={handleSetupConfirm}>{t.setupContinue}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="phoneClientWrap">
      <header className="phoneHeader">
        <h1>{clientLabel}</h1>
        <div className="phoneHeaderRight">
          <button className="phoneSettingsBtn" onClick={() => {
            setSetupName(resolvedLabel);
            setSetupUserId(resolvedUserId);
            setSetupDone(false);
          }} title={t.settings}>⚙</button>
          <span className={`phoneConn ${connected ? "on" : "off"}`}>{connected ? t.online : t.offline}</span>
        </div>
      </header>

      <section className="phoneChannels">
        {availableChannels.map((ch) => {
          const selected = activeChannel === ch.id;
          const speakers = activeSpeakersByChannel.get(ch.id) || [];
          const listening = listenChannels.has(ch.id);
          return (
            <div
              key={ch.id}
              tabIndex={0}
              className={`phoneChannelCard ${selected ? "selected" : ""}`}
              onClick={() => setActiveChannel(ch.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveChannel(ch.id)}
              style={{ borderLeftColor: ch.color }}
            >
              <div className="phoneChannelTop">
                <strong>{ch.name}</strong>
                <span className={`tallyDot ${speakers.length > 0 ? "tallyLive" : ""}`} />
              </div>
              <small>{speakers.length > 0 ? `${t.liveLabel}: ${speakers.slice(0, 2).join(", ")}` : t.idle}</small>
              <label className="phoneListenToggle" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={listening} onChange={() => toggleListen(ch.id)} />
                {t.listen}
              </label>
            </div>
          );
        })}
      </section>

      <section className="phonePttSection">
        {!isSecureContext && (
          <div className="phoneBanner statusWarn">{t.micErrorNoHTTPS}</div>
        )}
        {micError && <div className="phoneBanner statusWarn">{micError}</div>}

        <div className="phoneMicRow">
          {!stream ? (
            <button className="phoneMicEnableBtn" onClick={() => { void requestAudio(); }}>
              {permissionState === "denied" ? t.retryMic : t.enableMic}
            </button>
          ) : (
            <>
              <div className="micMeter">
                <span>🎤</span>
                <div className="meterTrack">
                  <div className="meterFill" style={{ width: `${micLevel}%` }} />
                </div>
                <span>{micLevel}%</span>
              </div>
              <button className="phoneMicReleaseBtn" onClick={releaseAudio}>{t.releaseMic}</button>
            </>
          )}
        </div>

        <div className="phoneActive">
          {t.activeLabel}: {channels.find((c) => c.id === activeChannel)?.name || "-"}
          {myUser ? ` · ${t.userLabel}: ${myUser.name}` : ` · ${t.userLabel}: ${t.userUnassigned}`}
        </div>

        <PttSlider talking={talking} onTalkStart={() => { void beginTalk(); }} onTalkEnd={endTalk} />

        {audioDevices.length > 0 && (
          <details className="phoneAudioDetails">
            <summary>Audio</summary>
            <div className="deviceSelects">
              <label>{t.audioInput}
                <select value={inputDevice} onChange={(event) => { void handleInputDeviceChange(event.target.value); }}>
                  <option value="">{t.audioDefault}</option>
                  {audioDevices.filter((device) => device.kind === "audioinput").map((device) => (
                    <option key={device.deviceId || device.label} value={device.deviceId}>{device.label || t.unnamedMic}</option>
                  ))}
                </select>
              </label>
              <label>{t.audioOutput}
                <select
                  value={outputDevice}
                  onChange={(event) => { handleOutputDeviceChange(event.target.value); }}
                  disabled={!outputSelectionSupported}
                >
                  <option value="">{t.systemDefault}</option>
                  {audioDevices.filter((device) => device.kind === "audiooutput").map((device) => (
                    <option key={device.deviceId || device.label} value={device.deviceId}>{device.label || t.unnamedOutput}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
