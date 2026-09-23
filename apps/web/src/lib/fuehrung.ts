/**
 * Die Fuehrung durch den ersten Start (#22).
 *
 * Vorher waren die ersten drei Bildschirme dieser Anwendung drei Textfolien
 * in einem Kasten. Sie erklaerten, was ein Intercom ist und dass man zum
 * Sprechen die PTT-Leiste schiebt — und liessen die eine Frage offen, die
 * jemand beim ERSTEN Start wirklich hat: wie lege ich die Leute an, die
 * nachher sprechen sollen? Ohne einen einzigen Benutzer bleibt jedes Beltpack
 * ohne Rechte, und das merkt man erst, wenn das Handy stumm bleibt.
 *
 * Die Fuehrung zeigt den Weg statt ihn zu beschreiben: sie wechselt in den
 * richtigen Bereich und hebt die Bedienpunkte in der Reihenfolge hervor, in
 * der man sie anfassen muss.
 *
 * Bauform
 * -------
 * Modul-Singleton mit `useSyncExternalStore`, kein Context. Die Fuehrung
 * betrifft drei Ebenen gleichzeitig — App (Seitenwechsel), ConfigView
 * (Reiterwechsel) und den Glow-Host —, und ein Context dafuer waere mehr
 * Geruest als Sache.
 *
 * Ziele werden ueber `data-fuehrung="…"` angesprochen und nicht ueber
 * CSS-Klassen: Klassennamen aendern sich beim Umgestalten, und ein Selektor
 * darauf bricht dann still. Ein Attribut, das nur dafuer da ist, faellt beim
 * Loeschen auf.
 */
import { useSyncExternalStore } from "react";

export interface FuehrungsSchritt {
  /** Wert des `data-fuehrung`-Attributs am hervorzuhebenden Element. */
  ziel: string;
  titel: string;
  text: string;
  /**
   * Wohin die Anwendung muss, damit das Ziel ueberhaupt im Dokument steht.
   * App und ConfigView lesen das und schalten selbst um — die Fuehrung
   * greift nicht in fremde Zustaende.
   */
  seite?: "monitor" | "setup";
  reiter?: "channels" | "devices" | "audio" | "plan" | "settings";
  /**
   * Geht der Schritt von selbst weiter, wenn man das Ziel benutzt?
   *
   * Bei einem Knopf ja — wer ihn drueckt, hat den Schritt getan. Bei einem
   * Eingabefeld nein: dort steht man noch, waehrend man tippt.
   */
  weiterBeiKlick?: boolean;
}

/**
 * Der Weg zum ersten Benutzer.
 *
 * Reihenfolge ist der echte Weg durch die Oberflaeche und nicht die
 * Reihenfolge im Menue: Setup oeffnen, Reiter waehlen, Name, Rolle, anlegen.
 */
export const ERSTER_BENUTZER: FuehrungsSchritt[] = [
  {
    ziel: "nav-setup",
    seite: "monitor",
    titel: "Hier wird eingerichtet",
    text: "Alles, was einmal pro Produktion eingestellt wird, liegt unter „Setup“.",
    weiterBeiKlick: true,
  },
  {
    ziel: "tab-devices",
    seite: "setup",
    titel: "Geräte & Benutzer",
    text: "Beltpacks, Handys und die Leute, die sie benutzen.",
    weiterBeiKlick: true,
  },
  {
    ziel: "user-name",
    seite: "setup",
    reiter: "devices",
    titel: "Wer spricht?",
    text: "Ein Name, unter dem die Person in den Konferenzen auftaucht — „Regie“, „Kamera 2“, „Ton“.",
  },
  {
    ziel: "user-rolle",
    seite: "setup",
    reiter: "devices",
    titel: "Was darf sie?",
    text: "Die Rolle entscheidet über Rechte. Im Zweifel die einfachste nehmen — ändern geht jederzeit.",
  },
  {
    ziel: "user-anlegen",
    seite: "setup",
    reiter: "devices",
    titel: "Anlegen",
    text: "Danach bekommt der Benutzer seine Konferenzen zugewiesen — das ist die Zeile, die gleich unten erscheint.",
    weiterBeiKlick: true,
  },
];

interface Zustand {
  laeuft: boolean;
  schritte: FuehrungsSchritt[];
  index: number;
}

let zustand: Zustand = { laeuft: false, schritte: [], index: 0 };
const zuhoerer = new Set<() => void>();
const melden = () => zuhoerer.forEach((f) => f());

/** Merkt serverfrei, dass der erste Start durch ist. */
const ERLEDIGT_SCHLUESSEL = "fuehrungErsterBenutzerErledigt";

export function fuehrungStarten(schritte: FuehrungsSchritt[] = ERSTER_BENUTZER) {
  zustand = { laeuft: true, schritte, index: 0 };
  melden();
}

export function fuehrungWeiter() {
  if (!zustand.laeuft) return;
  const naechster = zustand.index + 1;
  if (naechster >= zustand.schritte.length) {
    fuehrungBeenden();
    return;
  }
  zustand = { ...zustand, index: naechster };
  melden();
}

export function fuehrungZurueck() {
  if (!zustand.laeuft || zustand.index === 0) return;
  zustand = { ...zustand, index: zustand.index - 1 };
  melden();
}

export function fuehrungBeenden() {
  if (!zustand.laeuft) return;
  localStorage.setItem(ERLEDIGT_SCHLUESSEL, "1");
  zustand = { laeuft: false, schritte: [], index: 0 };
  melden();
}

/** Lief die Fuehrung schon einmal durch? */
export function fuehrungErledigt(): boolean {
  return localStorage.getItem(ERLEDIGT_SCHLUESSEL) === "1";
}

export function useFuehrung(): Zustand & { schritt: FuehrungsSchritt | null } {
  const z = useSyncExternalStore(
    (f) => { zuhoerer.add(f); return () => { zuhoerer.delete(f); }; },
    () => zustand,
    () => zustand,
  );
  return { ...z, schritt: z.laeuft ? z.schritte[z.index] ?? null : null };
}
