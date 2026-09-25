// Pure part of the device library connection: server address, the local copy
// of the library and how a sync response changes it. No storage, no fetch —
// `scripts/device-library-check.mjs` runs this file directly under Node.
import { DEFAULT_DEVICE_LIBRARY_URL, type SyncDevice, type SyncResponse } from "./deviceLibraryClient.ts";
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
  /** The server this copy came from. A copy never outlives a server change. */
  server: string;
  latestSeq: number;
  entries: Record<string, LibraryEntry>;
  rejected: Record<string, RejectedEntry>;
  syncedAt?: string;
}

export const emptyCache = (server: string): LibraryCache => ({ server, latestSeq: 0, entries: {}, rejected: {} });

/** The stored copy if it belongs to `server` and still reads; otherwise a fresh one. */
export function cacheFor(stored: unknown, server: string): LibraryCache {
  if (!stored || typeof stored !== "object") return emptyCache(server);
  const c = stored as Partial<LibraryCache>;
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
