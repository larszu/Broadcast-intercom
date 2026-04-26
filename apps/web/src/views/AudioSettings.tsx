import { useState } from "react";
import type { AudioSettings, BeltpackDevice, CoreState } from "@broadcast/shared";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="sliderRow">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="sliderVal">{value} dB</span>
    </label>
  );
}

function DeviceAudio({ device, api }: { device: BeltpackDevice; api: Props["api"] }) {
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState<AudioSettings>(device.audio);
  const [dirty, setDirty] = useState(false);

  function update(partial: Partial<AudioSettings>) {
    setAudio((a) => ({ ...a, ...partial }));
    setDirty(true);
  }

  async function save() {
    await api("PATCH", `/api/devices/${device.id}/audio`, audio);
    setDirty(false);
  }

  return (
    <div className="audioCard">
      <div className="audioCardHeader" onClick={() => setOpen((o) => !o)}>
        <strong>{device.label}</strong>
        <span className={`badge ${device.transport}`}>{device.transport.toUpperCase()}</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="audioCardBody">
          <Slider label="Input gain" min={-30} max={30} step={1}
            value={audio.inputGainDb} onChange={(v) => update({ inputGainDb: v })} />
          <Slider label="Output gain" min={-30} max={30} step={1}
            value={audio.outputGainDb} onChange={(v) => update({ outputGainDb: v })} />
          <label className="sliderRow">
            <span>Sidetone</span>
            <input type="range" min={0} max={100} step={1} value={audio.sidetonePercent}
              onChange={(e) => update({ sidetonePercent: parseInt(e.target.value) })} />
            <span className="sliderVal">{audio.sidetonePercent}%</span>
          </label>
          <Slider label="Noise gate" min={-80} max={0} step={1}
            value={audio.noiseGateDb} onChange={(v) => update({ noiseGateDb: v })} />
          <label className="checkRow">
            <input type="checkbox" checked={audio.limiterEnabled}
              onChange={(e) => update({ limiterEnabled: e.target.checked })} />
            Limiter enabled
          </label>
          <button disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</button>
        </div>
      )}
    </div>
  );
}

export function AudioSettings({ state, api }: Props) {
  const devices = Object.values(state.devices) as BeltpackDevice[];
  return (
    <div className="viewPanel">
      <h2>Audio Settings</h2>
      {devices.length === 0 && <p>No devices configured.</p>}
      {devices.map((d) => <DeviceAudio key={d.id} device={d} api={api} />)}
    </div>
  );
}
