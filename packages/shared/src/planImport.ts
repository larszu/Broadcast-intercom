// ───────────────────────────────────────────────────────────────────────────
// Den Intercom-Plan aus dem AV-Planner einlesen (B-41.2).
//
// WORUM ES GEHT. Der `cable-planner` exportiert seit `cable#684` ein
// herstellerneutrales Intercom-Format (`avplan-intercom`): welche Konferenzen
// es gibt, welche Sprechstellen daran haengen, und je Zugehoerigkeit getrennt,
// ob die Stelle spricht oder nur mithoert. Gelesen hat das bisher niemand. Wer
// die Anlage geplant hat, tippte die Konferenzen hier ein zweites Mal ab —
// also genau die Doppelerfassung, gegen die das Format geschrieben wurde.
//
// WARUM DAS ZUSAMMENFUEHREN UND NICHT ERSETZEN. Der Plan kennt Rollen und
// Konferenzen. Diese Anlage kennt zusaetzlich Geraete, Antennen, Zuordnungen
// und laufende Sitzungen — nichts davon kann ein Plan wiederherstellen. Ein
// Import, der den Zustand ersetzt, wuerfe das weg. Deshalb:
//
//   * Zusammengefuehrt wird ueber den NAMEN, nicht ueber die Id aus der Datei.
//     `ch-3` bedeutet auf dieser Anlage nichts; „PGM" bedeutet etwas, weil es
//     das ist, was in der Regie gesagt wird. Ueber die Datei-Id zu gehen
//     hiesse, beim zweiten Import alles zu verdoppeln.
//   * Geloescht wird NIE. Was der Plan nicht nennt, bleibt stehen und wird im
//     Abgleich aufgezaehlt. Das ist die andere Entscheidung als beim
//     Tally-Weg (dort verschwinden ungenannte Geraete, weil der Plan dort die
//     ganze Wahrheit ist) — und sie faellt hier anders, weil dieser Server
//     Dinge besitzt, die im Plan gar nicht vorkommen koennen.
//   * Die Systemkanaele (Announcement, Emergency, Program) sind unantastbar.
//     Sie sind keine geplanten Konferenzen, sondern Eigenschaften der Anlage.
//
// WAS DIE DATEI UEBER SICH SELBST SAGT. `derivedFrom` steht im Format, weil
// eine aus Green-GO abgeleitete Datei talk UND listen gesetzt hat — dort ist
// die Zugehoerigkeit EINE Liste. Das ist keine Messung, sondern die aermere
// Quelle. Der Abgleich reicht den Satz durch, statt ihn zu schlucken: wer eine
// Sprechberechtigung in eine fremde Anlage traegt, soll wissen, woher sie
// kommt.
//
// KEINE UHR, KEIN DATEI-IO. Reine Funktionen; der Aufrufer gibt `now` herein
// und schreibt die Konfiguration. Dieselbe Aufteilung wie im Planer, und aus
// demselben Grund pruefbar.
// ───────────────────────────────────────────────────────────────────────────
import {
  SYSTEM_CHANNEL_ANNOUNCEMENT,
  SYSTEM_CHANNEL_EMERGENCY,
  SYSTEM_CHANNEL_PROGRAM,
  defaultCallBehavior,
  type Channel,
  type CoreState,
  type IntercomUser,
} from "./index";

export const INTERCOM_PLAN_FORMAT = "avplan-intercom";

/** Eine Konferenz aus dem Plan ("PGM", "CAM", "Ton"). */
export interface PlanChannel {
  id: string;
  name: string;
  purpose?: string;
}

/** Wie eine Sprechstelle an einer Konferenz haengt. */
export interface PlanMembership {
  channelId: string;
  talk: boolean;
  listen: boolean;
}

/** Eine Sprechstelle / Rolle aus dem Plan ("Regie", "Kamera 1"). */
export interface PlanStation {
  id: string;
  name: string;
  shortName?: string;
  memberships: PlanMembership[];
  /** Geraet im Verkabelungsplan — hier nur durchgereicht, nicht aufgeloest. */
  equipmentId?: string;
}

export interface IntercomPlanFile {
  format: typeof INTERCOM_PLAN_FORMAT;
  version: number;
  exportedAt?: string;
  systemName: string;
  description?: string;
  channels: PlanChannel[];
  stations: PlanStation[];
  vendor?: Record<string, unknown>;
  derivedFrom?: string;
}

/**
 * Systemkanal? Als Funktion und nicht als Konstante am Modulkopf.
 *
 * `index.ts` reicht diese Datei nach aussen weiter, und diese Datei liest von
 * dort die drei Kennungen -- ein Kreis. Ein `new Set([...])` beim Laden faellt
 * darin in die temporale Totzone und wirft beim Start des Servers
 * („Cannot access 'SYSTEM_CHANNEL_ANNOUNCEMENT' before initialization",
 * gemessen). Zur Aufrufzeit ist alles da.
 */
const istSystemKanal = (id: string): boolean =>
  id === SYSTEM_CHANNEL_ANNOUNCEMENT ||
  id === SYSTEM_CHANNEL_EMERGENCY ||
  id === SYSTEM_CHANNEL_PROGRAM;

/**
 * Vergleichsform eines Namens.
 *
 * Klein und ohne Randabstand: „PGM ", „pgm" und „PGM" sind dieselbe Konferenz.
 * Weiter zu normalisieren (Bindestriche, Umlaute) waere geraten — zwei Kanaele,
 * die wirklich „CAM-1" und „CAM 1" heissen, sind womoeglich zwei.
 */
const key = (name: string): string => name.trim().toLowerCase();

/**
 * Eine feste Farbfolge. Bewusst deterministisch: ein zweiter Import derselben
 * Datei darf die Farben nicht durchmischen — sie sind das, woran jemand die
 * Kanaele auf dem Geraet auseinanderhaelt.
 */
const PALETTE = [
  "#c1121f", "#0077b6", "#2a9d8f", "#f4a261",
  "#8338ec", "#3a86ff", "#fb5607", "#06d6a0",
];

/** Ein gelesener Wert, der ein Intercom-Plan sein soll. */
export function parseIntercomPlan(text: string): IntercomPlanFile | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  if (!roh || typeof roh !== "object") return null;
  const o = roh as Record<string, unknown>;
  if (o.format !== INTERCOM_PLAN_FORMAT) return null;
  if (typeof o.version !== "number") return null;
  if (!Array.isArray(o.channels) || !Array.isArray(o.stations)) return null;

  const channels: PlanChannel[] = [];
  for (const c of o.channels as unknown[]) {
    if (!c || typeof c !== "object") continue;
    const x = c as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.name !== "string" || !x.name.trim()) continue;
    channels.push({
      id: x.id,
      name: x.name.trim(),
      ...(typeof x.purpose === "string" ? { purpose: x.purpose } : {}),
    });
  }

  const stations: PlanStation[] = [];
  for (const s of o.stations as unknown[]) {
    if (!s || typeof s !== "object") continue;
    const x = s as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.name !== "string" || !x.name.trim()) continue;
    const memberships: PlanMembership[] = [];
    if (Array.isArray(x.memberships)) {
      for (const m of x.memberships as unknown[]) {
        if (!m || typeof m !== "object") continue;
        const y = m as Record<string, unknown>;
        if (typeof y.channelId !== "string") continue;
        // Fehlt eine der beiden Angaben, gilt sie als NICHT gesetzt. Eine
        // fehlende Sprechberechtigung zu erfinden waere der teurere Fehler:
        // wer nicht sprechen soll, soll auch nicht koennen.
        memberships.push({
          channelId: y.channelId,
          talk: y.talk === true,
          listen: y.listen === true,
        });
      }
    }
    stations.push({
      id: x.id,
      name: x.name.trim(),
      ...(typeof x.shortName === "string" ? { shortName: x.shortName } : {}),
      memberships,
      ...(typeof x.equipmentId === "string" ? { equipmentId: x.equipmentId } : {}),
    });
  }

  return {
    format: INTERCOM_PLAN_FORMAT,
    version: o.version,
    ...(typeof o.exportedAt === "string" ? { exportedAt: o.exportedAt } : {}),
    systemName: typeof o.systemName === "string" ? o.systemName : "",
    ...(typeof o.description === "string" ? { description: o.description } : {}),
    channels,
    stations,
    ...(o.vendor && typeof o.vendor === "object" ? { vendor: o.vendor as Record<string, unknown> } : {}),
    ...(typeof o.derivedFrom === "string" ? { derivedFrom: o.derivedFrom } : {}),
  };
}

/** Was ein Import an einem Kanal oder einer Sprechstelle taete. */
export interface PlanChangeItem {
  name: string;
  /** Vorhandene Id, wenn er schon da ist. */
  existingId?: string;
  /** Klartext, was sich aendert — leer bei „neu" und bei „unveraendert". */
  changes: string[];
}

export interface IntercomPlanDiff {
  systemName: string;
  exportedAt?: string;
  /** Der Satz aus der Datei, woraus sie gebaut wurde. Unveraendert durchgereicht. */
  derivedFrom?: string;
  /**
   * Kanaele kennen hier nur „neu", „schon da" und „nicht im Plan" — es gibt
   * kein `updated`, weil der Plan an einem vorhandenen Kanal nichts zu aendern
   * haette: der Name ist der Schluessel, und die Farbe gehoert der Anlage. Ein
   * leeres Feld `updated` mitzufuehren, das nie etwas enthaelt, waere eine
   * Zusicherung ohne Inhalt.
   */
  channels: {
    added: PlanChangeItem[];
    unchanged: PlanChangeItem[];
    /** Auf dieser Anlage vorhanden, im Plan nicht genannt. Bleibt stehen. */
    keptOutsidePlan: PlanChangeItem[];
  };
  users: {
    added: PlanChangeItem[];
    updated: PlanChangeItem[];
    unchanged: PlanChangeItem[];
    keptOutsidePlan: PlanChangeItem[];
  };
  /**
   * Zugehoerigkeiten, deren Kanal in der Datei nicht vorkommt. Kein Fehler des
   * Servers, aber auch nichts, was still verschwinden darf.
   */
  danglingMemberships: { station: string; channelId: string }[];
}

const vendorColors = (
  file: IntercomPlanFile,
  feld: "groupColors" | "userColors",
): Record<string, string> => {
  const greengo = (file.vendor?.greengo ?? null) as Record<string, unknown> | null;
  const roh = greengo?.[feld];
  if (!roh || typeof roh !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) {
    // Green-GO fuehrt Farben als Index, nicht als Hexwert. Nur echte Hexwerte
    // uebernehmen — eine Zahl als CSS-Farbe waere eine unsichtbare Kachel.
    if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
  }
  return out;
};

/**
 * Was der Import taete — ohne ihn zu tun.
 *
 * Der Abgleich ist kein Beiwerk. Ein Import schreibt Sprechberechtigungen in
 * eine Anlage, an der gleich jemand arbeitet; wer ihn ausloest, soll vorher
 * lesen koennen, was sich bewegt. Dieselbe Regel wie beim Tally-Weg.
 */
export function diffIntercomPlan(state: CoreState, file: IntercomPlanFile): IntercomPlanDiff {
  const planChannelByKey = new Map<string, PlanChannel>();
  for (const c of file.channels) planChannelByKey.set(key(c.name), c);

  const stateChannelByKey = new Map<string, Channel>();
  for (const c of Object.values(state.channels)) {
    if (istSystemKanal(c.id)) continue;
    stateChannelByKey.set(key(c.name), c);
  }

  // Kanal-Id in der Datei -> Kanal-Id auf dieser Anlage (oder neu).
  const zielKanalId = new Map<string, string>();
  const channels: IntercomPlanDiff["channels"] = {
    added: [], unchanged: [], keptOutsidePlan: [],
  };
  file.channels.forEach((c) => {
    const da = stateChannelByKey.get(key(c.name));
    if (da) {
      zielKanalId.set(c.id, da.id);
      // Der Name IST der Schluessel, die Farbe gehoert der Anlage: ein
      // Import, der sie ueberschreibt, aendert das Geraetebild fuer eine
      // Angabe, die der Plan gar nicht fuehrt.
      channels.unchanged.push({ name: c.name, existingId: da.id, changes: [] });
    } else {
      channels.added.push({ name: c.name, changes: [] });
    }
  });
  for (const c of stateChannelByKey.values()) {
    if (!planChannelByKey.has(key(c.name))) {
      channels.keptOutsidePlan.push({ name: c.name, existingId: c.id, changes: [] });
    }
  }

  // Fuer die Berechtigungs-Vorschau brauchen neue Kanaele schon eine Id.
  let n = Object.keys(state.channels).length;
  for (const c of file.channels) {
    if (!zielKanalId.has(c.id)) {
      n += 1;
      zielKanalId.set(c.id, `ch${n}`);
    }
  }

  const stateUserByKey = new Map<string, IntercomUser>();
  for (const u of Object.values(state.users)) stateUserByKey.set(key(u.name), u);
  const planStationByKey = new Map<string, PlanStation>();
  for (const s of file.stations) planStationByKey.set(key(s.name), s);

  const users: IntercomPlanDiff["users"] = {
    added: [], updated: [], unchanged: [], keptOutsidePlan: [],
  };
  const danglingMemberships: IntercomPlanDiff["danglingMemberships"] = [];

  for (const s of file.stations) {
    const talk: string[] = [];
    const listen: string[] = [];
    for (const m of s.memberships) {
      const ziel = zielKanalId.get(m.channelId);
      if (!ziel) {
        danglingMemberships.push({ station: s.name, channelId: m.channelId });
        continue;
      }
      if (m.talk) talk.push(ziel);
      if (m.listen) listen.push(ziel);
    }
    const da = stateUserByKey.get(key(s.name));
    if (!da) {
      users.added.push({ name: s.name, changes: [] });
      continue;
    }
    const aenderungen: string[] = [];
    const gleich = (a: string[], b: string[]) =>
      a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
    if (!gleich(da.permissions.talkChannelIds, talk)) {
      aenderungen.push(`spricht auf ${talk.length} statt ${da.permissions.talkChannelIds.length} Kanälen`);
    }
    if (!gleich(da.permissions.listenChannelIds, listen)) {
      aenderungen.push(`hört ${listen.length} statt ${da.permissions.listenChannelIds.length} Kanäle`);
    }
    if (aenderungen.length > 0) {
      users.updated.push({ name: s.name, existingId: da.id, changes: aenderungen });
    } else {
      users.unchanged.push({ name: s.name, existingId: da.id, changes: [] });
    }
  }
  for (const u of stateUserByKey.values()) {
    if (!planStationByKey.has(key(u.name))) {
      users.keptOutsidePlan.push({ name: u.name, existingId: u.id, changes: [] });
    }
  }

  return {
    systemName: file.systemName,
    ...(file.exportedAt ? { exportedAt: file.exportedAt } : {}),
    ...(file.derivedFrom ? { derivedFrom: file.derivedFrom } : {}),
    channels,
    users,
    danglingMemberships,
  };
}

/**
 * Den Plan in den Zustand einarbeiten.
 *
 * Liefert einen NEUEN Zustand; der uebergebene bleibt unberuehrt. Alles, was
 * der Plan nicht kennt — Geraete, Antennen, Sitzungen, Matrix, Bridge —, geht
 * unveraendert mit.
 */
export function applyIntercomPlan(
  state: CoreState,
  file: IntercomPlanFile,
  now: number,
): { state: CoreState; diff: IntercomPlanDiff } {
  const diff = diffIntercomPlan(state, file);

  const channels: Record<string, Channel> = { ...state.channels };
  const vorhandenNachName = new Map<string, Channel>();
  for (const c of Object.values(channels)) {
    if (!istSystemKanal(c.id)) vorhandenNachName.set(key(c.name), c);
  }

  const kanalFarben = vendorColors(file, "groupColors");
  const zielKanalId = new Map<string, string>();
  let n = Object.keys(channels).length;
  file.channels.forEach((c, i) => {
    const da = vorhandenNachName.get(key(c.name));
    if (da) {
      zielKanalId.set(c.id, da.id);
      return;
    }
    n += 1;
    let id = `ch${n}`;
    // Freie Id suchen, statt eine bestehende zu ueberschreiben: die Zaehlung
    // ueber die Anzahl trifft daneben, sobald jemand einen Kanal geloescht hat.
    while (channels[id]) {
      n += 1;
      id = `ch${n}`;
    }
    channels[id] = {
      id,
      name: c.name,
      color: kanalFarben[c.id] ?? PALETTE[i % PALETTE.length],
      type: "group",
    };
    zielKanalId.set(c.id, id);
  });

  const users: Record<string, IntercomUser> = { ...state.users };
  const vorhandeneNutzer = new Map<string, IntercomUser>();
  for (const u of Object.values(users)) vorhandeneNutzer.set(key(u.name), u);
  const nutzerFarben = vendorColors(file, "userColors");

  file.stations.forEach((s, i) => {
    const talk: string[] = [];
    const listen: string[] = [];
    for (const m of s.memberships) {
      const ziel = zielKanalId.get(m.channelId);
      if (!ziel) continue;
      if (m.talk) talk.push(ziel);
      if (m.listen) listen.push(ziel);
    }
    const da = vorhandeneNutzer.get(key(s.name));
    if (da) {
      users[da.id] = {
        ...da,
        permissions: {
          ...da.permissions,
          talkChannelIds: talk,
          listenChannelIds: listen,
        },
        updatedAt: now,
      };
      return;
    }
    // Neue Sprechstelle. Rolle `operator` und NICHT geraten: der Plan fuehrt
    // keine Rollen im Sinne dieser Anlage. Wer eine Regie zum `director`
    // machen will, tut das hier — eine Rechtevergabe aus einem Namen
    // abzuleiten waere die falsche Art von Hilfsbereitschaft.
    const id = `user-plan-${key(s.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `${i + 1}`}`;
    users[id] = {
      id,
      name: s.name,
      role: "operator",
      color: nutzerFarben[s.id] ?? PALETTE[(i + 3) % PALETTE.length],
      permissions: {
        talkChannelIds: talk,
        listenChannelIds: listen,
        transcriptionChannelIds: [],
        canAllCall: false,
        canManageDevices: false,
      },
      callBehavior: defaultCallBehavior(),
      assignedDeviceIds: [],
      createdAt: now,
      updatedAt: now,
    };
  });

  return { state: { ...state, channels, users }, diff };
}
