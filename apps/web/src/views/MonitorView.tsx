import { useMemo, useState } from "react";
import type { CoreState, EventItem, BeltpackDevice } from "@broadcast/shared";
import { TranscriptView } from "./TranscriptView";
import { useLang } from "../i18n";
import type { AudioChunkPayload } from "../hooks/useIntercomStore";

interface Props {
  state: CoreState;
  events: EventItem[];
  sendWs: (msg: unknown) => void;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
  setAudioChunkHandler: (fn: ((p: AudioChunkPayload) => void) | null) => void;
  onSwitchToSetup?: () => void;
}

type RightTab = "devices" | "events" | "transcripts";

function BatteryBar({ pct, charging }: { pct: number; charging?: boolean }) {
  const color = pct >= 60 ? "var(--success)" : pct >= 25 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="batteryBar" title={`${pct}%${charging ? " ⚡" : ""}`}>
      <div className="batteryBarFill" style={{ width: `${pct}%`, background: color }} />
      <span className="batteryPct">{pct}%{charging ? " ⚡" : ""}</span>
    </div>
  );
}

export function MonitorView({ state, events, api, onSwitchToSetup }: Props) {
  const { t } = useLang();
  const [rightTab, setRightTab] = useState<RightTab>("devices");
  const devices = useMemo(() => Object.values(state.devices) as BeltpackDevice[], [state.devices]);
  const now = Date.now();
  const talkingCount = devices.filter((d) => d.talkChannelId).length;
  const onlineCount = devices.filter((d) => d.lastSeenAt && now - d.lastSeenAt < 8000).length;

  return (
    <div className="monitorLayout">
      <div className="monitorStatusStrip">
        <span className="monitorStat">
          <span className={`statDot ${onlineCount > 0 ? "on" : "off"}`} />
          {onlineCount}/{devices.length} {t.tabDeviceStatus}
        </span>
        {talkingCount > 0 && (
          <span className="monitorStat talking">
            🎙 {talkingCount} {t.dashTalking}
          </span>
        )}

      </div>

      <div className="monitorBody">
        <div className="monitorRight" style={{ flex: 1 }}>
          <div className="innerTabBar">
            {(["devices", "events", "transcripts"] as RightTab[]).map((tab) => {
              const labels: Record<RightTab, string> = {
                devices: t.tabDeviceStatus,
                events: t.tabEvents,
                transcripts: t.tabTranscriptsMon,
              };
              return (
                <button
                  key={tab}
                  className={`innerTab ${rightTab === tab ? "active" : ""}`}
                  onClick={() => setRightTab(tab)}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <div className="monitorRightContent">
            {rightTab === "devices" && (
              <div className="deviceCards">
                {devices.length === 0 && (
                  <p className="emptyHint">{t.dashNoDevices}</p>
                )}
                {devices.map((d) => {
                  const online = Boolean(d.lastSeenAt && now - d.lastSeenAt < 8000);
                  const talking = Boolean(d.talkChannelId);
                  const user = d.userId ? state.users[d.userId] : null;
                  const talkCh = d.talkChannelId ? (state.channels[d.talkChannelId]?.name ?? d.talkChannelId) : null;

                  return (
                    <div key={d.id} className={`deviceCard ${online ? "online" : "offline"} ${talking ? "talking" : ""}`}>
                      <div className="deviceCardHeader">
                        <span className={`onlineDot ${online ? "on" : "off"}`} />
                        <strong className="deviceCardName">{d.label}</strong>
                        <span className={`transportBadge ${d.transport}`}>{d.transport === "wifi" ? "WiFi" : "ETH"}</span>
                      </div>

                      <div className="deviceCardMeta">
                        <span className="dcMetaUser">👤 {user?.name ?? "—"}</span>
                        {talkCh && <span className="dcMetaTalking">🎙 {talkCh}</span>}
                        {!talkCh && <span className="dcMetaIdle">—</span>}
                      </div>

                      {d.battery && <BatteryBar pct={d.battery.percent} charging={d.battery.charging} />}
                    </div>
                  );
                })}
              </div>
            )}

            {rightTab === "events" && (
              <div className="eventLog">
                {events.length === 0 && <p className="emptyHint">—</p>}
                {[...events].reverse().map((e) => (
                  <div key={e.id} className="eventItem">
                    <span className="eventTime">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className={`eventBadge evtype-${e.type}`}>{e.type}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "transcripts" && (
              <TranscriptView state={state} api={api} compact />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
