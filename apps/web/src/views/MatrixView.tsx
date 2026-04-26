import type { BeltpackDevice, Channel, CoreState, MatrixRoute } from "@broadcast/shared";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

export function MatrixView({ state, api }: Props) {
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
        <h2>Matrix Routing</h2>
        <p>Add devices and channels first.</p>
      </div>
    );
  }

  return (
    <div className="viewPanel">
      <h2>Matrix Routing</h2>
      <p>Each cell enables talk-routing from a source device to a destination device on a specific channel.</p>

      <div className="matrixScroll">
        <table className="matrixTable">
          <thead>
            <tr>
              <th>From \ To</th>
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
                        title={self ? "Self" : `${from.label} → ${to.label} on ${ch.name}`}
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
