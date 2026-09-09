#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Sind die Schieberegler zu treffen? — Lauf: `npm run slider:check`
//
// Nutzer-Meldung 2026-09-09: „Passe auch die Ui von allen slidern an sodass
// man sie gut bedienen kann."
//
// GEMESSEN WURDE VORHER: fuer `input[type=range]` stand im Stilblatt nur
// BREITE (`flex: 1`, `width: 120px`, `width: 100px`, `width: 80px`). Die Hoehe
// blieb, was der Browser vorgibt — in WebKit rund 16 px. WCAG 2.2,
// Erfolgskriterium 2.5.8 („Target Size (Minimum)", Stufe AA), nennt 24 px als
// Mindestmass fuer eine Trefferflaeche. Apples 44 pt sind eine
// Herstellerempfehlung und keine Norm; deshalb steht hier die 24.
//
// WARUM DAS HIER MEHR IST ALS KOSMETIK. An diesen Reglern haengen
// Lautstaerke, VOX-Schwelle und Kompressor-Schwelle einer laufenden
// Intercom-Anlage. Wer im Betrieb danebengreift, dreht am falschen Wert oder
// verreisst den getroffenen — beides mitten in einer Sendung, beides hoerbar.
//
// WAS DIESER LAUF NICHT KANN: Er liest das Stilblatt und die Regler im
// Quelltext. Das ist WENIGER als eine Messung am gerenderten Fenster — was
// `gap`, Zeilenhoehe und ein umgebendes `transform` daraus machen, sieht er
// nicht. Er steht trotzdem hier, weil die beiden Wege, auf denen ein Regler
// wieder schrumpft, BEIDE textlich sichtbar sind: jemand dreht die Zahl im
// Stilblatt zurueck, oder jemand haengt an einen einzelnen Regler einen
// Inline-Stil, der gegen jeden Selektor gewinnt. Genau diese zwei fragt er
// ab, und er sagt von sich aus, dass er nur diese zwei kennt.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const STIL = join(WURZEL, 'apps/web/src/styles.css');

/** WCAG 2.2 SC 2.5.8, Stufe AA. Eine Norm mit einer Zahl. */
const MINDESTHOEHE = 24;
/** Der sichtbare Griff. Kleiner als das findet der Daumen die Bahn nicht. */
const MINDESTGRIFF = 18;

const fehler = [];

// Die Kommentare RAUS, bevor gemessen wird: der Kommentar ueber der Regel
// erklaert `height: 24px` und wuerde sonst als Regel gelesen. Eine Pruefung,
// die ihre eigene Begruendung wiederfindet, ist gruen auf dem Defekt.
const css = readFileSync(STIL, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const block = (selektor) => {
  const i = css.indexOf(selektor);
  if (i < 0) return null;
  const auf = css.indexOf('{', i);
  const zu = css.indexOf('}', auf);
  return auf < 0 || zu < 0 ? null : css.slice(auf + 1, zu);
};

const px = (rumpf, eigenschaft) => {
  if (!rumpf) return null;
  const m = new RegExp(`${eigenschaft}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(rumpf);
  return m ? Number(m[1]) : null;
};

// ── 1. Das Stilblatt ──────────────────────────────────────────────────────
const hoehe = px(block('input[type="range"] {'), 'height');
if (hoehe === null) {
  fehler.push('input[type="range"] hat keine Hoehe in px — dann misst dieser Lauf nichts.');
} else if (hoehe < MINDESTHOEHE) {
  fehler.push(
    `Die Trefferflaeche ist ${hoehe} px hoch, gebraucht werden ${MINDESTHOEHE} ` +
      '(WCAG 2.2 SC 2.5.8, Stufe AA).',
  );
}

for (const [name, selektor] of [
  ['WebKit', 'input[type="range"]::-webkit-slider-thumb {'],
  ['Firefox', 'input[type="range"]::-moz-range-thumb {'],
]) {
  const rumpf = block(selektor);
  if (!rumpf) {
    // Ohne den Firefox-Zweig bleibt es dort beim Standardaussehen, und die
    // Messung stimmte nur in einem Browser.
    fehler.push(`Der Griff fuer ${name} fehlt (${selektor.replace(' {', '')}).`);
    continue;
  }
  const g = px(rumpf, 'width');
  if (g === null) fehler.push(`Der Griff fuer ${name} hat keine Breite in px.`);
  else if (g < MINDESTGRIFF) {
    fehler.push(`Der Griff fuer ${name} ist ${g} px breit, gebraucht werden ${MINDESTGRIFF}.`);
  }
}

// ── 2. Kein Regler schrumpft sich per Inline-Stil zurueck ────────────────
const dateien = [];
const gehe = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') gehe(p); }
    else if (/\.tsx?$/.test(e)) dateien.push(p);
  }
};
gehe(join(WURZEL, 'apps/web/src'));

const VERDAECHTIG = /height:\s*'?(\d+)/;
let geprueft = 0;
for (const datei of dateien) {
  const quelle = readFileSync(datei, 'utf8');
  for (const m of quelle.matchAll(/<input\b[^>]*type="range"[^>]*>/g)) {
    geprueft += 1;
    const stil = /style=\{\{([^}]*)\}\}/.exec(m[0])?.[1] ?? '';
    const treffer = VERDAECHTIG.exec(stil);
    if (!treffer) continue;
    if (Number(treffer[1]) >= MINDESTHOEHE) continue;
    const zeile = quelle.slice(0, m.index).split('\n').length;
    fehler.push(
      `${datei.replace(WURZEL + '/', '')}:${zeile} — der Regler traegt "${treffer[0]}" und ` +
        'ueberschreibt damit die Hoehe aus dem Stilblatt.',
    );
  }
}

// ── 3. Die Gegenprobe zum Lauf selbst ─────────────────────────────────────
//
// Ohne sie waere ein Lauf, der KEINEN Regler findet, gruen — und genau so
// sieht ein kaputtes Muster aus.
if (geprueft === 0) {
  fehler.push(
    'Kein einziger `type="range"` gefunden. Entweder gibt es keine Regler mehr ' +
      '(dann gehoert dieser Lauf weg), oder das Muster passt nicht mehr.',
  );
}

if (fehler.length > 0) {
  console.error('FEHLER: Schieberegler sind nicht zu treffen:\n' +
    fehler.map((f) => `  · ${f}`).join('\n'));
  process.exit(1);
}

console.log(
  `OK: ${geprueft} Schieberegler, Trefferflaeche ${hoehe} px (Norm ${MINDESTHOEHE}), ` +
    'Griff in beiden Browser-Familien gesetzt.',
);
console.log(
  'Gemessen wurde am Stilblatt und an den Reglern im Quelltext — nicht am ' +
    'gerenderten Fenster. Was `gap`, Zeilenhoehe und ein umgebendes ' +
    '`transform` daraus machen, sieht dieser Lauf nicht.',
);
