import { useEffect, useState } from "react";
import { useLang, type Strings } from "../i18n";
import { actions, useDeviceLibrary, type LibraryState } from "../lib/deviceLibrary/deviceLibraryStore";
import { DEFAULT_DEVICE_LIBRARY_URL, forgotPasswordUrl, registerUrl } from "../lib/deviceLibrary/deviceLibraryClient";

export function libraryErrorText(t: Strings, error: LibraryState["error"]): string {
  switch (error) {
    case "wrong-credentials": return t.libErrWrongCredentials;
    case "email-not-verified": return t.libErrEmailNotVerified;
    case "guidelines-outdated": return t.libErrGuidelinesOutdated;
    case "exists": return t.libErrExists;
    case "wrong-code": return t.libErrWrongCode;
    case "rate-limited": return t.libErrRateLimited;
    case "not-signed-in": return t.libErrNotSignedIn;
    case "offline": return t.libErrOffline;
    case "server": return t.libErrServer;
    case "invalid-url": return t.libErrInvalidUrl;
    case "insecure-url": return t.libErrInsecureUrl;
    case null: return "";
    default: {
      // A new code in the client without a text here fails the build.
      const missing: never = error;
      return missing;
    }
  }
}

export const guidelinesUrl = (server: string) => `${server.replace(/\/+$/, "")}/guidelines`;

/** Error line; for outdated guidelines with the link to accept them again. */
export function LibraryErrorMessage({ error, server }: { error: LibraryState["error"]; server: string }) {
  const { t } = useLang();
  const text = libraryErrorText(t, error);
  if (!text) return null;
  return (
    <p className="libError" role="alert">
      {text}
      {error === "guidelines-outdated" && (
        <> <a href={guidelinesUrl(server)} target="_blank" rel="noreferrer">{t.libErrGuidelinesLink}</a></>
      )}
    </p>
  );
}

export function DeviceLibrarySettings() {
  const { t } = useLang();
  const lib = useDeviceLibrary();
  const [server, setServer] = useState(lib.server);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => setServer(lib.server), [lib.server]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    await actions.signIn(login, password);
    setPassword("");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    await actions.verify(code);
    setCode("");
  }

  const error = libraryErrorText(t, lib.error);

  return (
    <div className="softSection libSection">
      <h3>{t.libTitle}</h3>
      <p className="libHint">{t.libIntro}</p>

      <form className="libRow" onSubmit={(e) => { e.preventDefault(); void actions.setServer(server); }}>
        <label className="libField libFieldWide">
          <span>{t.libServer}{!lib.serverCustom && <em className="libDim"> · {t.libServerDefault}</em>}</span>
          <input className="textInput" value={server} onChange={(e) => setServer(e.target.value)} spellCheck={false} />
        </label>
        <button type="submit" disabled={lib.busy || server.trim() === lib.server}>{t.libServerApply}</button>
        {lib.serverCustom && (
          <button type="button" className="btnGhost" disabled={lib.busy} title={DEFAULT_DEVICE_LIBRARY_URL} onClick={() => void actions.setServer(null)}>
            {t.libServerReset}
          </button>
        )}
      </form>

      {lib.phase === "loading" && <p className="libHint">{t.libChecking}</p>}

      {lib.phase === "signed-out" && (
        <form className="libRow" onSubmit={(e) => void signIn(e)}>
          <label className="libField">
            <span>{t.libLogin}</span>
            <input className="textInput" value={login} autoComplete="username" onChange={(e) => setLogin(e.target.value)} />
          </label>
          <label className="libField">
            <span>{t.libPassword}</span>
            <input className="textInput" type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="btnAccent" disabled={lib.busy || !login.trim() || !password}>{t.libSignIn}</button>
        </form>
      )}

      {lib.phase === "second-factor" && (
        <form className="libRow" onSubmit={(e) => void verify(e)}>
          <label className="libField">
            <span>{t.libCode}</span>
            <input className="textInput" value={code} inputMode="numeric" autoComplete="one-time-code" autoFocus onChange={(e) => setCode(e.target.value)} />
          </label>
          <button type="submit" className="btnAccent" disabled={lib.busy || !code.trim()}>{t.libVerify}</button>
          <button type="button" className="btnGhost" onClick={() => void actions.cancelSecondFactor()}>{t.libCancel}</button>
        </form>
      )}

      {lib.phase === "signed-in" && (
        <div className="libRow">
          <span className="libState">
            {lib.user ? <>{t.libSignedInAs} <strong>{lib.user.username || lib.user.email}</strong></> : t.libSignedInOffline}
          </span>
          <button type="button" onClick={() => void actions.signOut()}>{t.libSignOut}</button>
        </div>
      )}
      {lib.phase === "signed-in" && lib.tokenSessionOnly && <p className="libHint">{t.libSessionOnly}</p>}
      {lib.phase === "signed-out" && !error && <p className="libHint">{t.libSignedOut}</p>}

      <LibraryErrorMessage error={lib.error} server={lib.server} />

      <div className="libLinks">
        <a href={registerUrl(lib.server)} target="_blank" rel="noreferrer">{t.libRegister}</a>
        <a href={forgotPasswordUrl(lib.server)} target="_blank" rel="noreferrer">{t.libForgot}</a>
      </div>
    </div>
  );
}
