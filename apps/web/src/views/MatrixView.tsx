import type { BeltpackDevice, Channel, CoreState, MatrixRoute } from "@broadcast/shared";
import { useLang } from "../i18n";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

export function MatrixView({ state, api }: Props) {
  const { t } = useLang();
  const devices = Object.values(state.devices) as BeltpackDevice[];
  const channels = Object.values(state.channels) as Channel[];
  const routes = state.matrixRoutes;

  function isEnabled(fromId: string, toId: string, chId: string): boolean {
    return routes.some(
      (r: MatrixRoute) => r.fromDeviceId === fromId && r.toDeviceId === toId && r.channelId === chId && r.enabled
    );
  }

  async function toggle(fromId: string, toId: string, chId: string, current: boolean) {
    await api("PATCH", "/api/matrix", {
      fromDeviceId: fromId,
      toDeviceId: toId,
      channelId: chId,
      enabled: !current,
    });
  }

  if (devices.length === 0 || channels.length === 0) {
    return (
      <div className="viewPanel">
        <h2>{t.matrixTitle}</h2>
        <p>{t.matrixEmpty}</p>
      </div>
    );
  }

  return (
    <div className="viewPanel">
      <h2>{t.matrixTitle}</h2>
      <p>{t.matrixHint}</p>

      <div className="matrixScroll">
        <table className="matrixTable">
          <thead>
            <tr>
              <th>{t.matrixFromTo}</th>
              {devices.map((d) => (
                channels.map((ch) => (
                  <th key={`${d.id}-${ch.id}`} title={`${d.label} / ${ch.name}`}>
                    <div>{d.label}</div>
                    <div className="chBadgeTiny" style={{ background: ch.color }}>{ch.name}</div>
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.map((from) => (
              <tr key={from.id}>
                <td className="matrixLabel">
                  <strong>{from.label}</strong>
                  <span className={`badge ${from.transport}`}>{from.transport.toUpperCase()}</span>
                </td>
                {devices.map((to) =>
                  channels.map((ch) => {
                    const active = isEnabled(from.id, to.id, ch.id);
                    const self = from.id === to.id;
                    return (
                      <td
                        key={`${from.id}-${to.id}-${ch.id}`}
                        className={`matrixCell ${active ? "on" : ""} ${self ? "self" : ""}`}
                        onClick={() => !self && toggle(from.id, to.id, ch.id, active)}
                        title={self ? t.matrixSelf : t.matrixCellTip.replace("{from}", from.label).replace("{to}", to.label).replace("{channel}", ch.name)}
                      >
                        {self ? "—" : active ? "✓" : ""}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
