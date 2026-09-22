/**
 * Der Scheinwerfer der Fuehrung (#22).
 *
 * Legt einen pulsierenden Ring um das aktuelle Ziel und stellt eine
 * Sprechblase daneben. Beides liegt ueber der Oberflaeche und fasst sie nicht
 * an: der Ring ist ein eigenes, absolut positioniertes Element auf den
 * Massen des Ziels. Haette der Ring stattdessen eine Klasse am Zielelement
 * gesetzt, wuerde er dessen Layout veraendern (`outline` nicht, aber jede
 * Randaenderung schon) und in jedem Bereich anders aussehen.
 *
 * Die Position wird bei Groessenaenderung und beim Scrollen nachgefuehrt.
 * Ohne das steht der Ring nach dem ersten Scrollen irgendwo — und ein
 * Scheinwerfer, der auf die falsche Stelle zeigt, ist schlimmer als keiner.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { useFuehrung, fuehrungWeiter, fuehrungZurueck, fuehrungBeenden } from "../lib/fuehrung";

interface Kasten { top: number; left: number; width: number; height: number }

export function FuehrungsHost() {
  const { laeuft, schritt, index, schritte } = useFuehrung();
  const [kasten, setKasten] = useState<Kasten | null>(null);

  // Das Ziel kann erst nach dem Seiten-/Reiterwechsel im Dokument stehen.
  // Deshalb wird nicht einmal gemessen, sondern so lange, bis es da ist.
  useLayoutEffect(() => {
    if (!laeuft || !schritt) { setKasten(null); return; }

    let abgebrochen = false;
    let versuche = 0;

    const messen = () => {
      if (abgebrochen) return;
      const el = document.querySelector<HTMLElement>(`[data-fuehrung="${schritt.ziel}"]`);
      if (!el) {
        // Bis zu zwei Sekunden warten. Danach ist das Ziel nicht da — dann
        // zeigt die Blase ohne Ring, statt die Fuehrung abzuwuergen.
        if (versuche++ < 40) { window.setTimeout(messen, 50); }
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setKasten({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    messen();
    const nachfuehren = () => {
      const el = document.querySelector<HTMLElement>(`[data-fuehrung="${schritt.ziel}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setKasten({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", nachfuehren);
    window.addEventListener("scroll", nachfuehren, true);
    return () => {
      abgebrochen = true;
      window.removeEventListener("resize", nachfuehren);
      window.removeEventListener("scroll", nachfuehren, true);
    };
  }, [laeuft, schritt]);

  // Ein Schritt, der „weiter bei Klick" sagt, hoert am Ziel selbst zu. Der
  // Zuhoerer haengt in der Blasenphase am Dokument und prueft, ob der Klick
  // im Ziel lag — so bleibt das Zielelement unangetastet.
  useEffect(() => {
    if (!laeuft || !schritt?.weiterBeiKlick) return;
    const beiKlick = (ev: MouseEvent) => {
      const ziel = document.querySelector<HTMLElement>(`[data-fuehrung="${schritt.ziel}"]`);
      if (ziel && ev.target instanceof Node && ziel.contains(ev.target)) {
        // Erst die Oberflaeche ihren Klick verarbeiten lassen, dann weiter —
        // sonst sucht der naechste Schritt sein Ziel, bevor der Reiterwechsel
        // stattgefunden hat.
        window.setTimeout(() => fuehrungWeiter(), 0);
      }
    };
    document.addEventListener("click", beiKlick, true);
    return () => document.removeEventListener("click", beiKlick, true);
  }, [laeuft, schritt]);

  if (!laeuft || !schritt) return null;

  // Die Blase unter das Ziel, wenn darunter Platz ist, sonst darueber.
  const platzUnten = kasten ? window.innerHeight - (kasten.top + kasten.height) : 0;
  const untenAnsetzen = !kasten || platzUnten > 180;
  const blaseStil: React.CSSProperties = kasten
    ? {
        top: untenAnsetzen ? kasten.top + kasten.height + 12 : undefined,
        bottom: untenAnsetzen ? undefined : window.innerHeight - kasten.top + 12,
        left: Math.max(12, Math.min(kasten.left, window.innerWidth - 332)),
      }
    : { top: "40%", left: "50%", transform: "translateX(-50%)" };

  return (
    <>
      {kasten && (
        <div
          className="fuehrungRing"
          aria-hidden="true"
          style={{ top: kasten.top, left: kasten.left, width: kasten.width, height: kasten.height }}
        />
      )}
      <div className="fuehrungBlase" role="dialog" aria-live="polite" style={blaseStil}>
        <div className="fuehrungZaehler">Schritt {index + 1} von {schritte.length}</div>
        <h3 className="fuehrungTitel">{schritt.titel}</h3>
        <p className="fuehrungText">{schritt.text}</p>
        <div className="fuehrungFuss">
          <button className="btnGhost" onClick={fuehrungBeenden}>Abbrechen</button>
          <div className="fuehrungNav">
            {index > 0 && <button className="btnGhost" onClick={fuehrungZurueck}>←</button>}
            <button className="btnAccent" onClick={fuehrungWeiter}>
              {index === schritte.length - 1 ? "Fertig" : "Weiter"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
