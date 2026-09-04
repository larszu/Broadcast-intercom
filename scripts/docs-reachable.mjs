#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Jedes Dokument unter `docs/` ist von einer Einstiegsseite aus erreichbar.
//
// WARUM ES DAS GIBT. Gemessen 2026-09-04 ueber alle acht Repos: Dokumente
// unter `docs/` waren fast durchgaengig von keiner Einstiegsseite aus
// verlinkt — in `av-planner-suite` 67 von 67, in `cable-planner` 12 von 13,
// hier 2 von 2. Ein Dokument, das nur findet, wer den Ordner durchblaettert,
// ist praktisch nicht vorhanden.
//
// Es ist dieselbe Form, die diese Sitzung wiederholt gemessen hat: die Sache
// existiert, sie ist sorgfaeltig gemacht, und sie liegt ausserhalb des Weges,
// der zu ihr fuehrt.
//
// WIE ER PRÜFT. Nicht „steht jedes Dokument im Index" — dann wäre der Index
// selbst die Liste, die veraltet. Er läuft den LINK-GRAPHEN von den
// Einstiegsseiten ab: erreichbar ist, worauf irgendein erreichbares Dokument
// verlinkt. Ein Link auf ein VERZEICHNIS macht die Dokumente darin erreichbar —
// auf GitHub ist das ein gangbarer Weg, und ein Unter-Index muss dann nicht
// jede Datei einzeln aufzählen.
//
// WAS ER NICHT PRÜFT: ob der Linktext zum Ziel passt oder das Dokument inhaltlich
// stimmt. Nur, dass ein Weg dorthin existiert.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Wo ein Leser anfängt. Alles andere muss von hier aus verlinkt sein. */
const EINSTIEGE = ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'TESTING.md', 'SECURITY.md']

const alleDokumente = () => {
  const treffer = []
  const lauf = (verzeichnis) => {
    for (const eintrag of readdirSync(verzeichnis)) {
      const pfad = join(verzeichnis, eintrag)
      if (statSync(pfad).isDirectory()) {
        if (eintrag === 'node_modules' || eintrag.startsWith('.')) continue
        lauf(pfad)
        continue
      }
      if (/\.md$/i.test(eintrag)) treffer.push(relative(ROOT, pfad))
    }
  }
  lauf(join(ROOT, 'docs'))
  return treffer.sort()
}

/** Ziele relativer Markdown-Links: Dateien und Verzeichnisse, auf die Wurzel normalisiert. */
const zieleIn = (relativerPfad) => {
  const voll = join(ROOT, relativerPfad)
  if (!existsSync(voll)) return []
  const inhalt = readFileSync(voll, 'utf8')
  const ziele = []
  for (const treffer of inhalt.matchAll(/\]\(([^)\s]+?)(?:#[^)]*)?\)/g)) {
    const ziel = treffer[1]
    if (/^[a-z]+:\/\//i.test(ziel) || ziel.startsWith('#')) continue
    ziele.push(normalize(relative(ROOT, resolve(join(ROOT, dirname(relativerPfad)), ziel))))
  }
  return ziele
}

const erreichbar = () => {
  const gesehen = new Set()
  const offen = EINSTIEGE.filter((e) => existsSync(join(ROOT, e)))
  while (offen.length > 0) {
    const aktuell = offen.pop()
    if (gesehen.has(aktuell)) continue
    gesehen.add(aktuell)
    const voll = join(ROOT, aktuell)
    if (!existsSync(voll)) continue
    if (statSync(voll).isDirectory()) {
      // Ein Verzeichnis-Link erschliesst die Dokumente DARIN, nicht rekursiv:
      // wer `research/` verlinkt, hat die Unterordner nicht mit erschlossen.
      for (const eintrag of readdirSync(voll)) {
        if (/\.md$/i.test(eintrag)) gesehen.add(relative(ROOT, join(voll, eintrag)))
      }
      continue
    }
    offen.push(...zieleIn(aktuell))
  }
  return gesehen
}

const maengel = []

// README.md ist Pflicht: ohne sie liefe der Graph ins Leere und der Lauf waere
// gruen und wertlos. Die uebrigen Einstiegsseiten sind optional — nicht jedes
// Repo hat ein CONTRIBUTING, und ihr Fehlen ist kein Auffindbarkeits-Mangel.
if (!existsSync(join(ROOT, 'README.md'))) {
  maengel.push('README.md fehlt — ohne sie prueft dieses Skript ins Leere.')
}

const dokumente = alleDokumente()
if (dokumente.length === 0) {
  maengel.push('Keine Dokumente unter docs/ gefunden — vermutlich falsches Verzeichnis.')
}

const gesehen = erreichbar()
const waisen = dokumente.filter((d) => !gesehen.has(d))
for (const w of waisen) maengel.push(`verwaist: ${w}`)

// Ein toter Link macht ein Dokument genauso unerreichbar wie gar kein Link,
// sieht im Index aber nach Vollstaendigkeit aus.
for (const quelle of [...EINSTIEGE.filter((e) => existsSync(join(ROOT, e))), ...dokumente]) {
  for (const ziel of zieleIn(quelle)) {
    if (!/\.md$/i.test(ziel) && !existsSync(join(ROOT, ziel))) continue // nur Markdown-Ziele pruefen
    if (!existsSync(join(ROOT, ziel))) maengel.push(`toter Link: ${quelle} -> ${ziel}`)
  }
}

if (maengel.length === 0) {
  console.log(`OK: ${dokumente.length} Dokumente unter docs/, alle von einer Einstiegsseite aus erreichbar.`)
  process.exit(0)
}

console.error('Dokumentation nicht auffindbar:\n')
for (const m of maengel) console.error(`  - ${m}`)
console.error(
  '\nEin Dokument, das nur findet, wer den Ordner durchblaettert, ist praktisch\n' +
    'nicht vorhanden. In docs/README.md eintragen (oder von dort aus in einen\n' +
    'Unter-Index, der selbst verlinkt ist).',
)
process.exit(1)
