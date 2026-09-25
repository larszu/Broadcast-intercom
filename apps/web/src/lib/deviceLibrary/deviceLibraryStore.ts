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
  propose as proposeRemote,
  signIn as signInRemote,
  signOut as signOutRemote,
  sync as syncRemote,
  verifySecondFactor,
  type LibraryErrorCode,
  type LibraryUser,
  type SignInResult,
} from "./deviceLibraryClient.ts";
import { toFacet, type IntercomDeviceType } from "./intercomDeviceType.ts";
import { applySync, cacheFor, effectiveServer, readServerUrl, type LibraryCache } from "./librarySync.ts";

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
  error: LibraryErrorCode | "invalid-url" | "insecure-url" | null;
  busy: boolean;
  cache: LibraryCache;
  own: OwnDeviceType[];
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
};

function loadOwn(): OwnDeviceType[] {
  const raw = readJson(KEY_OWN);
  return Array.isArray(raw) ? (raw as OwnDeviceType[]).filter((t) => t && typeof t.id === "string" && t.facet) : [];
}

const listeners = new Set<() => void>();
function set(patch: Partial<LibraryState>) {
  state = { ...state, ...patch };
  if (patch.cache) write(KEY_CACHE, JSON.stringify(patch.cache));
  if (patch.own) write(KEY_OWN, JSON.stringify(patch.own));
  for (const l of listeners) l();
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
    await actions.sync();
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
  await actions.sync();
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
   * A new address is a new library: the token and the copy of the old one
   * are dropped, not carried over. Returns `false` when the address is refused.
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
    set({ server: next, serverCustom: next !== effectiveServer(null), cache: cacheFor(null, next) });
    await dropSession();
    return true;
  },
  async sync() {
    if (!token) return;
    set({ busy: true, error: null });
    try {
      const res = await syncRemote(state.server, token, "intercom", state.cache.latestSeq);
      set({ busy: false, cache: applySync(state.cache, res) });
    } catch (e) {
      const code = codeOf(e);
      if (code === "not-signed-in" || code === "wrong-credentials") await dropSession("not-signed-in");
      else set({ busy: false, error: code });
    }
  },
  /** Submits an own type. The library moderates it before others see it. */
  async propose(type: OwnDeviceType): Promise<{ slug: string; state: string }> {
    if (!token) throw new LibraryError("not-signed-in");
    if (!type.sourceUrl) throw new Error("datasheet link missing");
    const facet = toFacet(type);
    try {
      return await proposeRemote(
        state.server,
        token,
        "intercom",
        {
          manufacturer: type.manufacturer.trim(),
          model: type.model.trim(),
          category: "Intercom",
          description: type.description?.trim() || undefined,
          sourceUrl: type.sourceUrl.trim(),
        },
        facet as unknown as Record<string, unknown>,
      );
    } catch (e) {
      if (codeOf(e) === "not-signed-in") await dropSession("not-signed-in");
      throw e;
    }
  },
  saveOwn(type: OwnDeviceType) {
    const own = state.own.some((t) => t.id === type.id)
      ? state.own.map((t) => (t.id === type.id ? type : t))
      : [...state.own, type];
    set({ own });
  },
  deleteOwn(id: string) {
    set({ own: state.own.filter((t) => t.id !== id) });
  },
};

void restore();

export function useDeviceLibrary(): LibraryState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
