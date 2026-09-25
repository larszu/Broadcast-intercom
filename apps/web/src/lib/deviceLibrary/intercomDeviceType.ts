// ───────────────────────────────────────────────────────────────────────────
// Intercom device type — the `intercom` facet in the device library.
//
// The facet IS this planner's device type, not a library-only shape: what the
// library returns under `planners.intercom` is read with `readDeviceType`, and
// what goes out with `propose` is written with `toFacet`. One reader, one
// writer, so submitting and importing cannot drift apart.
//
// A type describes hardware, never a show. Label, id, IP, user, channel
// assignment and antenna link belong to a `BeltpackDevice` in a config and
// are not part of this format — `toFacet` builds the object field by field
// from the known keys, so nothing project-related can pass through.
//
// Vocabulary follows the vendor-neutral `avplan-intercom` exchange format and
// the core's own types: `transports` are `TransportType`, `keys.pages` and
// `keys.perPage` span the same page/button grid as `PlanKey`, `power` uses the
// sources of `BatteryState`.
// ───────────────────────────────────────────────────────────────────────────
import type { TransportType } from "@broadcast/shared";

export const DEVICE_TYPE_FORMAT = "intercom-device-type";
/** Highest facet version this planner understands. A newer one is rejected, not guessed. */
export const DEVICE_TYPE_VERSION = 1;

export const DEVICE_KINDS = ["beltpack", "deskstation", "antenna", "interface"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const DEVICE_TRANSPORTS: readonly TransportType[] = ["ethernet", "dect", "wifi"];
export const POWER_SOURCES = ["poe", "battery", "usb-c", "mains"] as const;
export type PowerSource = (typeof POWER_SOURCES)[number];
export const PROTOCOLS = ["aes67", "dante", "sip", "gpio", "2-wire", "4-wire"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export interface DeviceTypeAudio {
  /** Headset connectors. */
  headset?: number;
  /** Built-in speaker (desk stations, speaker stations). */
  speaker?: boolean;
  /** Analogue line inputs / outputs (interfaces). */
  lineIn?: number;
  lineOut?: number;
}

/** The facet object as stored in the library under `planners.intercom`. */
export interface IntercomDeviceTypeFacet {
  format: typeof DEVICE_TYPE_FORMAT;
  version: number;
  kind: DeviceKind;
  /** How the device reaches the core. At least one. */
  transports: TransportType[];
  /** Key grid of a beltpack or station: `pages` × `perPage` channel keys. */
  keys?: { pages: number; perPage: number };
  /** Antennas: beltpacks one antenna can carry at the same time. */
  dectCapacity?: number;
  power?: PowerSource[];
  audio?: DeviceTypeAudio;
  protocols?: Protocol[];
}

/** A device type as the planner keeps it: shared core fields plus the facet. */
export interface IntercomDeviceType {
  manufacturer: string;
  model: string;
  description?: string;
  /** Manufacturer datasheet. Required to submit to the library. */
  sourceUrl?: string;
  facet: IntercomDeviceTypeFacet;
}

export type DeviceTypeRead =
  | { ok: true; facet: IntercomDeviceTypeFacet }
  | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

function listOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T[] | string {
  if (!Array.isArray(v)) return `${field} is not a list`;
  const out: T[] = [];
  for (const x of v) {
    if (!allowed.includes(x as T)) return `${field}: unknown value "${String(x)}"`;
    if (!out.includes(x as T)) out.push(x as T);
  }
  return out;
}

/**
 * Reads a facet from the library (or from our own form). Everything not in the
 * format is dropped; everything in it is checked for meaning, not just type.
 */
export function readDeviceType(raw: unknown): DeviceTypeRead {
  if (!isObj(raw)) return { ok: false, reason: "facet is not an object" };
  if (raw.format !== DEVICE_TYPE_FORMAT) return { ok: false, reason: `format is not ${DEVICE_TYPE_FORMAT}` };
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1) {
    return { ok: false, reason: "version is missing" };
  }
  if (raw.version > DEVICE_TYPE_VERSION) {
    return { ok: false, reason: `version ${raw.version} is newer than this planner (${DEVICE_TYPE_VERSION})` };
  }
  if (!DEVICE_KINDS.includes(raw.kind as DeviceKind)) return { ok: false, reason: `unknown kind "${String(raw.kind)}"` };
  const kind = raw.kind as DeviceKind;

  const transports = listOf(raw.transports, DEVICE_TRANSPORTS, "transports");
  if (typeof transports === "string") return { ok: false, reason: transports };
  if (transports.length === 0) return { ok: false, reason: "no transport" };

  const facet: IntercomDeviceTypeFacet = { format: DEVICE_TYPE_FORMAT, version: DEVICE_TYPE_VERSION, kind, transports };

  if (raw.keys !== undefined) {
    if (!isObj(raw.keys) || !count(raw.keys.pages, 32) || !count(raw.keys.perPage, 64) || raw.keys.pages < 1 || raw.keys.perPage < 1) {
      return { ok: false, reason: "keys needs pages 1–32 and perPage 1–64" };
    }
    facet.keys = { pages: raw.keys.pages, perPage: raw.keys.perPage };
  }
  // A beltpack or station without keys cannot talk on anything.
  if ((kind === "beltpack" || kind === "deskstation") && !facet.keys) {
    return { ok: false, reason: `${kind} without keys` };
  }

  if (raw.dectCapacity !== undefined) {
    if (!count(raw.dectCapacity, 1000) || raw.dectCapacity < 1) return { ok: false, reason: "dectCapacity must be 1–1000" };
    facet.dectCapacity = raw.dectCapacity;
  }
  if (kind === "antenna" && !transports.includes("dect")) return { ok: false, reason: "antenna without dect" };

  if (raw.power !== undefined) {
    const power = listOf(raw.power, POWER_SOURCES, "power");
    if (typeof power === "string") return { ok: false, reason: power };
    if (power.length) facet.power = power;
  }
  if (raw.protocols !== undefined) {
    const protocols = listOf(raw.protocols, PROTOCOLS, "protocols");
    if (typeof protocols === "string") return { ok: false, reason: protocols };
    if (protocols.length) facet.protocols = protocols;
  }
  if (raw.audio !== undefined) {
    if (!isObj(raw.audio)) return { ok: false, reason: "audio is not an object" };
    const audio: DeviceTypeAudio = {};
    for (const k of ["headset", "lineIn", "lineOut"] as const) {
      const v = raw.audio[k];
      if (v === undefined) continue;
      if (!count(v, 64)) return { ok: false, reason: `audio.${k} must be 0–64` };
      audio[k] = v;
    }
    if (raw.audio.speaker !== undefined) {
      if (typeof raw.audio.speaker !== "boolean") return { ok: false, reason: "audio.speaker is not true/false" };
      audio.speaker = raw.audio.speaker;
    }
    if (Object.keys(audio).length) facet.audio = audio;
  }
  return { ok: true, facet };
}

/** The facet to submit. Goes through the reader, so only valid, known fields leave. */
export function toFacet(type: IntercomDeviceType): IntercomDeviceTypeFacet {
  const read = readDeviceType(type.facet);
  if (!read.ok) throw new Error(read.reason);
  return read.facet;
}

/** Channel keys of a type — pages × keys per page. */
export const keyCount = (f: IntercomDeviceTypeFacet): number => (f.keys ? f.keys.pages * f.keys.perPage : 0);

/** Which core device role a type maps to when a device is added from it; `null` = not a beltpack device. */
export const deviceRoleOf = (f: IntercomDeviceTypeFacet): "beltpack" | "deskstation" | null =>
  f.kind === "beltpack" || f.kind === "deskstation" ? f.kind : null;
