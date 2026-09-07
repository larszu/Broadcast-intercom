// Waechter fuer die Oberflaechen-Regeln (ADR-007 der av-planner-suite).
// Lauf: `npm run brand:check`
//
// WARUM DIE WERTE HIER EIN ZWEITES MAL STEHEN: sie stehen maschinenlesbar in
// `@avplan/ui` (`src/brand.ts`), aber dieses Repo haengt nicht an diesem
// Paket. Ohne diesen Check waere der Rueckweg in die alte Blau-Grau-Welt eine
// Zeile, die niemandem auffaellt. Regeln, die nur in einem Dokument stehen,
// driften.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(hier, '..', 'apps/web/src/styles.css'), 'utf8');

const token = (name) => {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : '';
};

// ── 1. Die Palette ist die der Marke ──────────────────────────────────────
assert.equal(token('--bg'), '#132040', 'Grund ist Deep Navy');
assert.equal(token('--bg3'), '#1D324F', 'Flaeche ist Zumpe Navy');
assert.equal(token('--text'), '#E1ECEF', 'Fliesstext ist Eisblau');
assert.equal(token('--text2'), '#8C9CB3', 'Gedaempft ist Stahlblau');
assert.equal(token('--accent'), '#F6F5F0', 'Aktionsflaeche ist Off-White');
assert.equal(token('--accent-text'), '#132040', 'darauf steht Navy');

// ── 2. Status ist nicht Signal ────────────────────────────────────────────
assert.equal(token('--success'), '#2F7D5C');
assert.equal(token('--warning'), '#C8892B');
assert.equal(token('--danger'), '#B04A3F');
assert.equal(token('--signal'), '#D6402E', 'Tally-Rot ist das Signal');
assert.notEqual(token('--danger'), token('--signal'), 'zwei Toene, zwei Zwecke');

// ── 3. Rot kommt nur als Signal vor ───────────────────────────────────────
const rotZeilen = css
  .split('\n')
  .map((z) => z.trim())
  .filter((z) => z.toUpperCase().includes('#D6402E'));
assert.ok(
  rotZeilen.every((z) => z.startsWith('--signal:')),
  `Tally-Rot steht ausserhalb von --signal: ${rotZeilen.join(' | ')}`,
);

// ── 4. Der Fokusring ist das Signal ───────────────────────────────────────
assert.ok(css.includes('outline: 2px solid var(--signal)'), 'Fokusring fehlt');
assert.ok(css.includes('outline-offset: 3px'), 'Fokus-Abstand fehlt');

// ── 5. Keine Rundungen, keine Verlaeufe, keine Schatten ───────────────────
for (const name of ['--radius', '--radius-lg', '--radius-xl']) {
  assert.equal(token(name), '0', `${name} ist nicht null`);
}
assert.ok(!/border-radius:\s*(50%|[1-9])/.test(css), 'harter Radius gefunden');
assert.ok(!/linear-gradient|radial-gradient/.test(css), 'Verlauf gefunden');
// Der Lookahead sitzt DIREKT hinter dem Doppelpunkt: mit `\s*` davor koennte
// das Muster ein Leerzeichen weniger nehmen und `none` doch als Treffer lesen.
assert.ok(!/box-shadow:(?!\s*none\s*;)[^;]+;/.test(css), 'Schatten gefunden');

// ── 6. Keine weisse Schrift auf der Off-White-Flaeche ─────────────────────
const unlesbar = css
  .split('\n')
  .filter((z) => z.includes('var(--accent)') && /color:\s*#fff/i.test(z));
assert.deepEqual(unlesbar, [], `Weiss auf Off-White: ${unlesbar.join(' | ')}`);

console.log('brand:check ok — Oberflaechen-Regeln (ADR-007) eingehalten');
