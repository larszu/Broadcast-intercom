// Browser side of the device library: where the address, the token, the
// library copy and the own device types live, and one store the settings
// panel, the device type list and the add-device form share.
//
// The token is never logged and never written into a show config. In the
// desktop app it goes to the main process, which encrypts it with Electron
// `safeStorage` (Keychain / DPAPI); in a plain browser it stays in this
// origin's localStorage.
import { useSyncExternalStore } from "react";
import {
  currentUser,
  LibraryError,
  signIn as signInRemote,
  signOut as signOutRemote,
  syncFrom,
  upload as uploadRemote,
  verifySecondFactor,
  type LibraryErrorCode,
  type LibraryUser,
  type SignInResult,
} from "./deviceLibraryClient.ts";
import type { IntercomDeviceType } from "./intercomDeviceType.ts";
import { applyUpload, ledgerFor, planUpload, pruneLedger, type UploadLedger } from "./libraryUpload.ts";
import { applySyncResult, cacheFor, effectiveServer, readServerUrl, withCache, type LibraryCache } from "./librarySync.ts";

interface DesktopTokenBridge {
  get(): Promise<string | null>;
  /** `false` when the OS offers no encryption — then nothing is stored. */
  set(token: string): Promise<boolean>;
  clear(): Promise<void>;
}

declare global {
  interface Window {
    intercomDesktop?: { deviceLibraryToken?: DesktopTokenBridge };
  }
}

const KEY_SERVER = "deviceLibrary.server";
const KEY_TOKEN = "deviceLibrary.token";
const KEY_CACHE = "deviceLibrary.cache";
const KEY_OWN = "deviceLibrary.ownTypes";
const KEY_UPLOADS = "deviceLibrary.uploads";
const KEY_AUTO = "deviceLibrary.autoUpload";
/** Edits come in bursts (typing, several saves); one upload after they settle. */
const AUTO_DELAY_MS = 2000;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Storage blocked: the session still works, it just is not remembered.
  }
};
const readJson = (k: string): unknown => {
  try {
    return JSON.parse(read(k) ?? "null");
  } catch {
    return null;
  }
};

/** Token bound to the server it was issued by. */
interface StoredToken {
  server: string;
  token: string;
}

const tokenStore = {
  async load(): Promise<StoredToken | null> {
    const bridge = window.intercomDesktop?.deviceLibraryToken;
    const raw = bridge ? await bridge.get() : read(KEY_TOKEN);
    try {
      const t = JSON.parse(raw ?? "null") as StoredToken | null;
      return t && typeof t.token === "string" && typeof t.server === "string" ? t : null;
    } catch {
      return null;
    }
  },
  /** `false` = kept for this session only. */
  async save(t: StoredToken): Promise<boolean> {
    const bridge = window.intercomDesktop?.deviceLibraryToken;
    if (bridge) return bridge.set(JSON.stringify(t));
    write(KEY_TOKEN, JSON.stringify(t));
    return true;
  },
  async clear(): Promise<void> {
    const bridge = window.intercomDesktop?.deviceLibraryToken;
    if (bridge) await bridge.clear();
    write(KEY_TOKEN, null);
  },
};

export type Phase = "loading" | "signed-out" | "second-factor" | "signed-in";

export interface OwnDeviceType extends IntercomDeviceType {
  id: string;
}

export interface LibraryState {
  server: string;
  /** Set by the user; `false` = release default. */
  serverCustom: boolean;
  phase: Phase;
  user: LibraryUser | null;
  /** Encryption missing in the desktop app: the sign-in lasts until the app closes. */
  tokenSessionOnly: boolean;
  /** `server-empty`: the server was set up anew and delivered nothing; the copy was kept. */
  error: LibraryErrorCode | "invalid-url" | "insecure-url" | "server-empty" | null;
  busy: boolean;
  /** The copy of `server`. Kept offline, on errors and after sign-out; the
   *  copies of other servers stay stored beside it. */
  cache: LibraryCache;
  own: OwnDeviceType[];
  /** Last upload per own type, with the hash of what was sent. */
  uploads: UploadLedger;
  /** Upload own types on start and after each change. Default on. */
  autoUpload: boolean;
}

let token: string | null = null;
let challenge: string | null = null;

const initialServer = effectiveServer(read(KEY_SERVER));
let state: LibraryState = {
  server: initialServer,
  serverCustom: initialServer !== effectiveServer(null),
  phase: "loading",
  user: null,
  tokenSessionOnly: false,
  error: null,
  busy: false,
  cache: cacheFor(readJson(KEY_CACHE), initialServer),
  own: loadOwn(),
  uploads: ledgerFor(readJson(KEY_UPLOADS), initialServer),
  autoUpload: read(KEY_AUTO) !== "0",
};

function loadOwn(): OwnDeviceType[] {
  const raw = readJson(KEY_OWN);
  return Array.isArray(raw) ? (raw as OwnDeviceType[]).filter((t) => t && typeof t.id === "string" && t.facet) : [];
}

const listeners = new Set<() => void>();
function set(patch: Partial<LibraryState>) {
  state = { ...state, ...patch };
  if (patch.own) write(KEY_OWN, JSON.stringify(patch.own));
  if (patch.uploads) write(KEY_UPLOADS, JSON.stringify(patch.uploads));
  for (const l of listeners) l();
}

/** Only a successful answer writes the copy — into its server's slot, beside the others. */
function persistCache(cache: LibraryCache) {
  write(KEY_CACHE, JSON.stringify(withCache(readJson(KEY_CACHE), cache)));
}

const codeOf = (e: unknown): LibraryErrorCode => (e instanceof LibraryError ? e.code : "offline");

async function restore() {
  const saved = await tokenStore.load();
  if (!saved || saved.server !== state.server) {
    if (saved) await tokenStore.clear();
    set({ phase: "signed-out" });
    return;
  }
  token = saved.token;
  try {
    const user = await currentUser(state.server, token);
    if (!user) {
      token = null;
      await tokenStore.clear();
      set({ phase: "signed-out", error: "not-signed-in" });
      return;
    }
    set({ phase: "signed-in", user });
    await actions.syncAuto();
  } catch {
    // Offline at start: keep the token, show the cached copy, sync later.
    set({ phase: "signed-in", user: null, error: "offline" });
  }
}
async function finish(r: SignInResult) {
  if (r.kind === "error") {
    set({ busy: false, error: r.code });
    return;
  }
  if (r.kind === "second-factor") {
    challenge = r.challenge;
    set({ busy: false, phase: "second-factor", error: null });
    return;
  }
  challenge = null;
  token = r.token;
  const stored = await tokenStore.save({ server: state.server, token: r.token });
  set({ busy: false, phase: "signed-in", user: r.user, error: null, tokenSessionOnly: !stored });
  await actions.syncAuto();
}

async function dropSession(error: LibraryState["error"] = null) {
  token = null;
  challenge = null;
  await tokenStore.clear();
  set({ phase: "signed-out", user: null, busy: false, error, tokenSessionOnly: false });
}

export const actions = {
  async signIn(login: string, password: string) {
    set({ busy: true, error: null });
    await finish(await signInRemote(state.server, login, password));
  },
  async verify(code: string) {
    if (!challenge) return dropSession();
    set({ busy: true, error: null });
    await finish(await verifySecondFactor(state.server, challenge, code));
  },
  async cancelSecondFactor() {
    challenge = null;
    set({ phase: "signed-out", error: null });
  },
  async signOut() {
    if (token) await signOutRemote(state.server, token);
    await dropSession();
  },
  /**
   * A new address is a new library: the token is dropped, and the copy shown
   * is the one stored for the new address (empty if there is none yet). The
   * copy of the old address stays stored — switching back brings it back.
   * Returns `false` when the address is refused.
   */
  async setServer(input: string | null): Promise<boolean> {
    let next: string;
    if (input === null) {
      next = effectiveServer(null);
      write(KEY_SERVER, null);
    } else {
      const r = readServerUrl(input);
      if (!r.ok) {
        set({ error: r.reason === "insecure" ? "insecure-url" : "invalid-url" });
        return false;
      }
      next = r.url;
      write(KEY_SERVER, next === effectiveServer(null) ? null : next);
    }
    if (next === state.server) {
      set({ error: null, serverCustom: next !== effectiveServer(null) });
      return true;
    }
    if (token) await signOutRemote(state.server, token);
    set({ server: next, serverCustom: next !== effectiveServer(null), cache: cacheFor(readJson(KEY_CACHE), next), uploads: ledgerFor(null, next) });
    await dropSession();
    return true;
  },
  async sync() {
    if (!token) return;
    set({ busy: true, error: null });
    const server = state.server;
    const from = state.cache;
    try {
      // `syncFrom` fetches everything again when the server is no longer the
      // same one, and refuses an empty full answer instead of handing it over.
      const next = applySyncResult(from, await syncFrom(server, token, "intercom", from.latestSeq));
      persistCache(next);
      // The address changed while the answer was on its way: stored in its
      // own slot, but not shown for the new address.
      if (state.server === server) set({ busy: false, cache: next });
      else set({ busy: false });
    } catch (e) {
      // Nothing here touches the copy: offline, timeout, server error and an
      // expired sign-in all leave the last synced devices usable.
      const code = codeOf(e);
      if (code === "not-signed-in" || code === "wrong-credentials") await dropSession("not-signed-in");
      else if (e instanceof LibraryError && e.message === "server-empty") set({ busy: false, error: "server-empty" });
      else set({ busy: false, error: code });
    }
  },
  /** Own types that are new, changed or failed go up; the answer is kept per type. */
  async upload() {
    if (!token) return;
    const plan = planUpload(state.own, state.uploads);
    if (plan.items.length === 0) {
      if (Object.keys(plan.local).length) set({ uploads: applyUpload(state.uploads, plan, []) });
      return;
    }
    set({ busy: true, error: null });
    try {
      const results = await uploadRemote(state.server, token, "intercom", plan.items);
      set({ busy: false, uploads: applyUpload(state.uploads, plan, results) });
    } catch (e) {
      const code = codeOf(e);
      if (code === "not-signed-in" || code === "wrong-credentials") await dropSession("not-signed-in");
      else set({ busy: false, error: code });
    }
  },
  /** "Sync now": up first, so the answer already contains what was just sent. */
  async syncNow() {
    // One run at a time; an edit during a run schedules the next one.
    if (running) return scheduleAuto();
    running = true;
    try {
      await actions.upload();
      if (token && !state.error) await actions.sync();
    } finally {
      running = false;
    }
  },
  /** After sign-in, at start and after edits: upload only when switched on. */
  async syncAuto() {
    if (state.autoUpload) await actions.syncNow();
    else await actions.sync();
  },
  setAutoUpload(on: boolean) {
    write(KEY_AUTO, on ? null : "0");
    set({ autoUpload: on });
    if (on) scheduleAuto();
  },
  saveOwn(type: OwnDeviceType) {
    const own = state.own.some((t) => t.id === type.id)
      ? state.own.map((t) => (t.id === type.id ? type : t))
      : [...state.own, type];
    set({ own });
    scheduleAuto();
  },
  deleteOwn(id: string) {
    const own = state.own.filter((t) => t.id !== id);
    // Only the local record goes. The library entry is shared and stays.
    set({ own, uploads: pruneLedger(state.uploads, own.map((t) => t.id)) });
  },
};

let running = false;
let autoTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAuto() {
  if (!state.autoUpload) return;
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    autoTimer = null;
    if (token && state.phase === "signed-in") void actions.syncNow();
  }, AUTO_DELAY_MS);
}

void restore();

/** The current state outside React — for `npm run library:check`. */
export const libraryState = (): LibraryState => state;

export function useDeviceLibrary(): LibraryState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
