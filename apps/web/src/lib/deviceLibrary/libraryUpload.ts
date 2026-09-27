// Own device types → library. Pure: what has to go up, and what the answer
// means for each type. `scripts/device-library-check.mjs` runs it under Node.
//
// "Changed" is decided by a hash of exactly what would be sent (core + facet
// in canonical key order). A type whose hash matches the last accepted upload
// is not sent again; an edit changes the hash and sends it. Failed uploads are
// retried, blocked ones only after an edit — the library would block the same
// data again.
import type { UploadItem, UploadResult, UploadState } from "./deviceLibraryClient.ts";
import { toFacet, type IntercomDeviceType } from "./intercomDeviceType.ts";

export interface UploadRecord {
  hash: string;
  state: UploadState;
  slug?: string;
  /** Why it failed or was blocked; `no-source` is decided locally. */
  error?: string;
  findings?: string[];
  at: string;
}

export interface UploadLedger {
  /** Records belong to one server; a server change starts over. */
  server: string;
  records: Record<string, UploadRecord>;
}

export const emptyLedger = (server: string): UploadLedger => ({ server, records: {} });

export function ledgerFor(stored: unknown, server: string): UploadLedger {
  const l = stored as Partial<UploadLedger> | null;
  if (!l || l.server !== server || !l.records || typeof l.records !== "object") return emptyLedger(server);
  return { server, records: l.records };
}

const canonical = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
};

/** FNV-1a, 32 bit — enough to notice an edit; not a security measure. */
export function hashOf(v: unknown): string {
  const s = JSON.stringify(canonical(v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type OwnType = IntercomDeviceType & { id: string };

/** Throws when the facet does not read — such a type never leaves. */
export function uploadItemOf(type: OwnType): UploadItem {
  return {
    localId: type.id,
    core: {
      manufacturer: type.manufacturer.trim(),
      model: type.model.trim(),
      category: "Intercom",
      ...(type.description?.trim() ? { description: type.description.trim() } : {}),
      sourceUrl: type.sourceUrl?.trim() ?? "",
    },
    facet: toFacet(type) as unknown as Record<string, unknown>,
  };
}

const DONE: UploadState[] = ["created", "edit-proposed", "pending-updated", "approved", "in-sync", "blocked"];

export interface UploadPlan {
  items: UploadItem[];
  hashes: Record<string, string>;
  /** Refused before sending (invalid facet, no datasheet link). */
  local: Record<string, UploadRecord>;
}

export function planUpload(own: OwnType[], ledger: UploadLedger, now = new Date()): UploadPlan {
  const plan: UploadPlan = { items: [], hashes: {}, local: {} };
  for (const t of own) {
    let item: UploadItem;
    try {
      item = uploadItemOf(t);
    } catch (e) {
      plan.local[t.id] = { hash: "", state: "error", error: (e as Error).message, at: now.toISOString() };
      continue;
    }
    const hash = hashOf(item);
    const rec = ledger.records[t.id];
    if (rec && rec.hash === hash && DONE.includes(rec.state)) continue;
    if (!item.core.sourceUrl) {
      // The library blocks a device nobody can look up; say so without a request.
      plan.local[t.id] = { hash, state: "blocked", error: "no-source", at: now.toISOString() };
      continue;
    }
    plan.items.push(item);
    plan.hashes[t.id] = hash;
  }
  return plan;
}

const findingKinds = (f: unknown): string[] | undefined =>
  Array.isArray(f) ? f.map((x) => String((x as { kind?: unknown })?.kind ?? x)) : undefined;

/** Records the answer. An item without an answer counts as failed, not as sent. */
export function applyUpload(ledger: UploadLedger, plan: UploadPlan, results: UploadResult[], now = new Date()): UploadLedger {
  const at = now.toISOString();
  const records = { ...ledger.records, ...plan.local };
  const byId = new Map(results.map((r) => [r.localId, r]));
  for (const item of plan.items) {
    const r = byId.get(item.localId);
    records[item.localId] = r
      ? { hash: plan.hashes[item.localId], state: r.state, slug: r.slug, error: r.error, findings: findingKinds(r.findings), at }
      : { hash: plan.hashes[item.localId], state: "error", error: "no-result", at };
  }
  return { server: ledger.server, records };
}

/** Records of deleted types go; the library entry stays (it is shared). */
export function pruneLedger(ledger: UploadLedger, ownIds: string[]): UploadLedger {
  const keep = new Set(ownIds);
  return { server: ledger.server, records: Object.fromEntries(Object.entries(ledger.records).filter(([id]) => keep.has(id))) };
}

/** Local view for one type: the stored state, or that it changed since. */
export function uploadStatus(type: OwnType, ledger: UploadLedger): UploadState | "changed" | "never" {
  const rec = ledger.records[type.id];
  if (!rec) return "never";
  let hash = "";
  try {
    hash = hashOf(uploadItemOf(type));
  } catch {
    return rec.state;
  }
  return rec.hash && rec.hash !== hash ? "changed" : rec.state;
}
