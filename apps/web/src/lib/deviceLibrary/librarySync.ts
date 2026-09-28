// Pure part of the device library connection: server address, the local copy
// of the library and how a sync response changes it. No storage, no fetch —
// `scripts/device-library-check.mjs` runs this file directly under Node.
import { DEFAULT_DEVICE_LIBRARY_URL, type SyncDevice, type SyncResponse, type SyncResult } from "./deviceLibraryClient.ts";
import { readDeviceType, type IntercomDeviceType } from "./intercomDeviceType.ts";

export type ServerUrlRead = { ok: true; url: string } | { ok: false; reason: "invalid" | "insecure" };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The token travels with every request, so the address must be https. Plain
 * http is accepted for a library running on this machine only (development).
 */
export function readServerUrl(input: string): ServerUrlRead {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.username || u.password || u.search || u.hash) return { ok: false, reason: "invalid" };
  if (u.protocol === "http:" && !LOCAL_HOSTS.has(u.hostname)) return { ok: false, reason: "insecure" };
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, reason: "invalid" };
  return { ok: true, url: `${u.origin}${u.pathname}`.replace(/\/+$/, "") };
}

/** No setting, or a stored value that no longer reads: the release default. */
export function effectiveServer(stored: string | null | undefined): string {
  if (!stored) return DEFAULT_DEVICE_LIBRARY_URL;
  const r = readServerUrl(stored);
  return r.ok ? r.url : DEFAULT_DEVICE_LIBRARY_URL;
}

export interface LibraryEntry {
  slug: string;
  version: number;
  seq: number;
  status: SyncDevice["status"];
  confirmations: number;
  category: string;
  type: IntercomDeviceType;
}

/** Delivered by the library, refused by this planner's own check. Counted, never used. */
export interface RejectedEntry {
  slug: string;
  manufacturer: string;
  model: string;
  reason: string;
}

export interface LibraryCache {
  /** The server this copy came from. Each server has its own copy (see `CacheStore`). */
  server: string;
  latestSeq: number;
  entries: Record<string, LibraryEntry>;
  rejected: Record<string, RejectedEntry>;
  syncedAt?: string;
}

export const emptyCache = (server: string): LibraryCache => ({ server, latestSeq: 0, entries: {}, rejected: {} });

/**
 * The copies of ALL servers, under one storage key.
 *
 * There used to be exactly one copy, and another server address meant: start
 * over — the old copy was gone. Whoever switched to a stand-in server because
 * devices.zumpelars.de was down, and switched back, had an empty library
 * afterwards. Now every server has its own slot (contract point 2 of
 * `syncFrom` in `deviceLibraryClient.ts`). A legacy single copy is read as the
 * slot of the server it came from — nothing is lost by the migration.
 */
export interface CacheStore {
  format: "intercom-device-library-caches";
  version: 1;
  /** Validated on read by `cacheFor`, so a broken slot never breaks the others. */
  byServer: Record<string, unknown>;
}

const emptyStore = (): CacheStore => ({ format: "intercom-device-library-caches", version: 1, byServer: {} });

/** Reads the new store, a legacy single copy, or nothing. */
export function readCacheStore(stored: unknown): CacheStore {
  if (!stored || typeof stored !== "object") return emptyStore();
  const s = stored as Partial<CacheStore> & Partial<LibraryCache>;
  if (s.format === "intercom-device-library-caches" && s.version === 1 && s.byServer && typeof s.byServer === "object") {
    return { ...emptyStore(), byServer: { ...s.byServer } };
  }
  // Legacy: one copy, carrying its server.
  if (typeof s.server === "string" && typeof s.latestSeq === "number") return { ...emptyStore(), byServer: { [s.server]: s } };
  return emptyStore();
}

/** The store with `cache` in its server's slot; the other servers' slots stay untouched. */
export function withCache(stored: unknown, cache: LibraryCache): CacheStore {
  const store = readCacheStore(stored);
  return { ...store, byServer: { ...store.byServer, [cache.server]: cache } };
}

/** The copy for `server` from the store (or a legacy copy) if it still reads; otherwise a fresh one. */
export function cacheFor(stored: unknown, server: string): LibraryCache {
  const slot = readCacheStore(stored).byServer[server];
  if (!slot || typeof slot !== "object") return emptyCache(server);
  const c = slot as Partial<LibraryCache>;
  if (c.server !== server || typeof c.latestSeq !== "number" || !c.entries || !c.rejected) return emptyCache(server);
  const entries: Record<string, LibraryEntry> = {};
  for (const [slug, e] of Object.entries(c.entries)) {
    const read = readDeviceType(e?.type?.facet);
    if (read.ok) entries[slug] = { ...e, type: { ...e.type, facet: read.facet } };
  }
  // An entry the current reader refuses (a planner downgrade, a hand-edited
  // store) forces a full sync — otherwise it would be missing until the
  // library happens to change that device again.
  if (Object.keys(entries).length !== Object.keys(c.entries).length) return emptyCache(server);
  return { server, latestSeq: c.latestSeq, entries, rejected: c.rejected, syncedAt: c.syncedAt };
}

/**
 * Applies one `/api/sync` answer. Incremental: only devices after the stored
 * `latestSeq` arrive, in any order; the highest `seq` per slug wins.
 */
export function applySync(cache: LibraryCache, res: SyncResponse, now = new Date()): LibraryCache {
  if (res.format !== "avplan-device-sync" || res.planner !== "intercom") throw new Error("unexpected sync answer");
  const entries = { ...cache.entries };
  const rejected = { ...cache.rejected };
  for (const d of [...res.devices].sort((a, b) => a.seq - b.seq)) {
    const held = entries[d.slug];
    if (held && d.seq < held.seq) continue;
    delete entries[d.slug];
    delete rejected[d.slug];
    if (d.removed) continue;
    const read = readDeviceType(d.facet);
    if (!read.ok) {
      rejected[d.slug] = { slug: d.slug, manufacturer: d.core.manufacturer, model: d.core.model, reason: read.reason };
      continue;
    }
    entries[d.slug] = {
      slug: d.slug,
      version: d.version,
      seq: d.seq,
      status: d.status,
      confirmations: d.confirmations,
      category: d.core.category,
      type: {
        manufacturer: d.core.manufacturer,
        model: d.core.model,
        description: d.core.description || undefined,
        sourceUrl: d.core.sourceUrl || undefined,
        facet: read.facet,
      },
    };
  }
  return {
    server: cache.server,
    latestSeq: Math.max(cache.latestSeq, res.latestSeq),
    entries,
    rejected,
    syncedAt: now.toISOString(),
  };
}

/**
 * Applies a `syncFrom` result. Whether the server is still the same one is
 * decided by `syncFrom` in the shared client — the same rule in every
 * planner. On `reset` the answer replaces the whole copy; an empty new server
 * never arrives here but as an error, and the copy stays.
 */
export function applySyncResult(cache: LibraryCache, result: SyncResult, now = new Date()): LibraryCache {
  return applySync(result.reset ? emptyCache(cache.server) : cache, result.response, now);
}
