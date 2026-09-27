import type { BeltpackDevice, CoreState, EventItem } from "@broadcast/shared";
import { useLang } from "../i18n";

interface Props {
  state: CoreState;
  events: EventItem[];
}

function battery(pct: number) {
  if (pct >= 75) return "🟢";
  if (pct >= 30) return "🟡";
  return "🔴";
}

export function Dashboard({ state, events }: Props) {
  const { t } = useLang();
  const devices = Object.values(state.devices) as BeltpackDevice[];
  const now = Date.now();

  return (
    <div className="viewPanel dashboardPanel">
      <div className="dashLeft">
        <h2>{t.dashDeviceStatus}</h2>
        <div className="deviceCards">
          {devices.map((d) => {
            const online = d.lastSeenAt && now - d.lastSeenAt < 8000;
            return (
              <div key={d.id} className={`deviceCard ${online ? "online" : "offline"}`}>
                <div className="deviceCardHeader">
                  <span className={`badge ${d.transport}`}>{d.transport.toUpperCase()}</span>
                  <strong>{d.label}</strong>
                  <span className={`onlineBadge ${online ? "on" : "off"}`}>{online ? t.dashOnline : t.dashOffline}</span>
                </div>
                {d.battery && (
                  <div className="statRow">
                    {battery(d.battery.percent)} {t.dashBattery} {d.battery.percent}%
                    {d.battery.charging && <span> ⚡ {t.dashCharging}</span>}
                  </div>
                )}
                {d.network && (
                  <div className="statRow">
                    📡 {t.dashSignal} {d.network.signal ?? "—"}%
                    {d.network.ip && <span> · {d.network.ip}</span>}
                  </div>
                )}
                <div className="talkListen">
                  <span>
                    👤 {d.userId ? (state.users[d.userId]?.name || d.userId) : t.dashUnassigned}
                  </span>
                  <span className={d.talkChannelId ? "talking" : ""}>
                    🎙 {d.talkChannelId ? (state.channels[d.talkChannelId]?.name || d.talkChannelId) : "—"}
                  </span>
                  <span>
                    👂 {d.listenChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || "—"}
                  </span>
                </div>
              </div>
            );
          })}
          {devices.length === 0 && <p>{t.dashNoDevices}</p>}
        </div>
      </div>

      <div className="dashRight">
        <h2>{t.dashEventLog}</h2>
        <div className="eventLog">
          {events.map((e) => (
            <div key={e.id} className="eventItem">
              <span className="eventTime">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className={`eventBadge evtype-${e.type}`}>{e.type}</span>
              <span>{e.message}</span>
            </div>
          ))}
          {events.length === 0 && <p>{t.dashNoEvents}</p>}
        </div>
      </div>
    </div>
  );
}
