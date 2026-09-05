import { useState } from "react";
import type { CoreState, EventItem } from "@broadcast/shared";
import { ChannelManager } from "./ChannelManager";
import { MatrixView } from "./MatrixView";
import { DeviceManager } from "./DeviceManager";
import { UserManager } from "./UserManager";
import { AudioSettings } from "./AudioSettings";
import { PluginBridgeSettings } from "./PluginBridgeSettings";
import { HostSettings } from "./HostSettings";
import { PlanImport } from "./PlanImport";
import { useLang } from "../i18n";

interface Props {
  state: CoreState;
  events: EventItem[];
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

type ConfigTab = "channels" | "devices" | "audio" | "plan" | "settings";

export function ConfigView({ state, events, api }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<ConfigTab>("channels");

  const tabs: { id: ConfigTab; label: string }[] = [
    { id: "channels", label: t.tabChannelsRouting },
    { id: "devices", label: t.tabDevicesUsers },
    { id: "audio", label: t.tabAudio },
    { id: "plan", label: t.tabPlanImport },
    { id: "settings", label: t.tabSettingsLogs },
  ];

  return (
    <div className="configViewLayout">
      <div className="configTabBar">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            className={`configTab ${tab === tb.id ? "active" : ""}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="configTabContent">
        {tab === "channels" && (
          <div className="configSplitPane">
            <div className="configSplitLeft">
              <ChannelManager state={state} api={api} />
            </div>
            <div className="configSplitRight configSplitBorder">
              <MatrixView state={state} api={api} />
            </div>
          </div>
        )}

        {tab === "devices" && (
          <div className="configSplitPane">
            <div className="configSplitLeft">
              <DeviceManager state={state} api={api} />
            </div>
            <div className="configSplitRight configSplitBorder">
              <UserManager state={state} api={api} />
            </div>
          </div>
        )}

        {tab === "audio" && (
          <div className="configAudioPane">
            <AudioSettings state={state} api={api} />
            <PluginBridgeSettings api={api} />
          </div>
        )}

        {tab === "plan" && (
          <div className="configAudioPane">
            <PlanImport api={api} />
          </div>
        )}

        {tab === "settings" && (
          <div className="configSplitPane">
            <div className="configSplitLeft">
              <HostSettings />
            </div>
            <div className="configSplitRight configSplitBorder">
              <div className="viewPanel">
                <h2>{t.tabEvents}</h2>
                <div className="eventLog eventLogFull">
                  {events.length === 0 && <p className="emptyHint">—</p>}
                  {[...events].reverse().map((e) => (
                    <div key={e.id} className="eventItem">
                      <span className="eventTime">{new Date(e.ts).toLocaleTimeString()}</span>
                      <span className={`eventBadge evtype-${e.type}`}>{e.type}</span>
                      <span>{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
