import { useState } from "react";
import type { CoreState, KeywordAction, KeywordRule } from "@broadcast/shared";
import { useLang } from "../i18n";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

type Result = { ok: boolean; error?: string };

function describe(a: KeywordAction, webhook: string): string {
  return a.kind === "webhook" ? `${webhook} ${a.url}` : `OSC ${a.host}:${a.port} ${a.address}`;
}

export function AutomationView({ state, api }: Props) {
  const { t } = useLang();
  const rules = state.keywordRules ?? [];
  const channels = Object.values(state.channels);
  const [keyword, setKeyword] = useState("");
  const [channelId, setChannelId] = useState("");
  const [kind, setKind] = useState<KeywordAction["kind"]>("osc");
  const [url, setUrl] = useState("");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("8000");
  const [address, setAddress] = useState("/intercom/keyword");
  const [message, setMessage] = useState("");

  async function add() {
    const action = kind === "webhook" ? { kind, url } : { kind, host, port: Number(port), address };
    const r = await api<Result>("POST", "/api/automation/rules", { keyword, channelId: channelId || undefined, action });
    if (r.ok) {
      setKeyword("");
      setMessage("");
    } else {
      setMessage(r.error ?? t.ruleFailed);
    }
  }

  async function test(rule: KeywordRule) {
    const r = await api<Result>("POST", `/api/automation/rules/${rule.id}/test`);
    setMessage(r.ok ? t.ruleTestSent.replace("{keyword}", rule.keyword) : `${t.ruleFailed}: ${r.error ?? ""}`);
  }

  return (
    <div className="viewPanel">
      <h2>{t.rulesTitle}</h2>
      <p className="dim">{t.rulesIntro}</p>

      <div className="ruleForm">
        <label>
          <span>{t.ruleKeyword}</span>
          <input value={keyword} placeholder={t.ruleKeywordPlaceholder} onChange={(e) => setKeyword(e.target.value)} />
        </label>
        <label>
          <span>{t.ruleChannel}</span>
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">{t.ruleAllChannels}</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>{t.ruleAction}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as KeywordAction["kind"])}>
            <option value="osc">OSC</option>
            <option value="webhook">{t.ruleWebhook}</option>
          </select>
        </label>
        {kind === "webhook" ? (
          <label className="ruleWide">
            <span>URL</span>
            <input value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              <span>{t.ruleHost}</span>
              <input value={host} onChange={(e) => setHost(e.target.value)} />
            </label>
            <label>
              <span>{t.rulePort}</span>
              <input value={port} inputMode="numeric" onChange={(e) => setPort(e.target.value)} />
            </label>
            <label>
              <span>{t.ruleAddress}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          </>
        )}
        <button onClick={() => void add()} disabled={!keyword.trim()}>{t.ruleAdd}</button>
      </div>
      {message && <p className="statusWarn">{message}</p>}

      {rules.length === 0 && <p className="emptyHint">{t.rulesEmpty}</p>}
      {rules.map((r) => (
        <div key={r.id} className="ruleRow">
          <label className="checkRow">
            <input
              type="checkbox"
              checked={r.enabled}
              aria-label={t.ruleEnabled}
              onChange={(e) => void api("PATCH", `/api/automation/rules/${r.id}`, { enabled: e.target.checked })}
            />
            <strong>{r.keyword}</strong>
          </label>
          <span className="dim">{r.channelId ? state.channels[r.channelId]?.name ?? r.channelId : t.ruleAllChannels}</span>
          <span className="ruleAction">{describe(r.action, t.ruleWebhook)}</span>
          <button className="btnSmall" onClick={() => void test(r)}>{t.ruleTest}</button>
          <button className="btnSmall" onClick={() => void api("DELETE", `/api/automation/rules/${r.id}`)}>{t.ruleDelete}</button>
        </div>
      ))}
    </div>
  );
}
