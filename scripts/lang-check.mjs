#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Quellsprache der Oberflaeche ist Englisch, Deutsch ist die Uebersetzung.
//
// WARUM ES DAS GIBT (2026-09-27): E-28 der Suite legt `en` als Quellsprache
// fuer alle Repos fest; die anderen Planner messen das mit `lang:check`,
// dieses Repo nicht. Gemessen stand hier ein Sprachmix: Geraeteverwaltung,
// Benutzerverwaltung, Fuehrung, Mikrofon-Meldungen und Plugin-Browser waren
// hart auf Deutsch — in einer englisch eingestellten Oberflaeche stand
// „User anlegen“ neben „Users & Permissions“. Beim Umstellen fiel auf, dass
// eine Liste bekannter Stellen nicht reicht: jede neue Ansicht bringt ihre
// eigenen Literale mit. Deshalb liest dieser Lauf den Syntaxbaum.
//
// Geprueft werden JSX-Text und String-Literale in `apps/web/src` ausser
// `i18n.tsx` (dort steht die Uebersetzung) und der kopierten Bibliotheks-
// Client-Datei. Kommentare zaehlen nicht; `data-*`-Attribute sind Kennungen.
//
// Lauf: `npm run lang:check`
// ───────────────────────────────────────────────────────────────────────────
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(import.meta.url)('typescript')
const WEB = join(ROOT, 'apps/web/src')
const AUSGENOMMEN = [/i18n\.tsx$/, /deviceLibraryClient\.ts$/]

// Umlaute und ß sind eindeutig. Dazu Woerter, die im Englischen nicht
// vorkommen und in diesem Bestand als Oberflaechentext standen.
const DEUTSCH = /[äöüÄÖÜß]|\b(und|oder|nicht|kein|keine|wird|werden|wurde|bitte|Bitte|Rolle|Farbe|Benutzer|Gerät|Geräte|anlegen|erlaubt|Darf|wirklich|entfernen|Entfernen|Bearbeiten|Speichern|Abbrechen|Hinzufügen|Schritt|Weiter|Fertig|Leer|Navigieren|Durchsuchen|Pfad|Fehler|Jetzt|Nur|Alle|Aus|Neuer|Neue|Einstellungen)\b/

const dateien = []
const lauf = (d) => {
	for (const f of readdirSync(d)) {
		const p = join(d, f)
		if (statSync(p).isDirectory()) lauf(p)
		else if (/\.tsx?$/.test(f) && !AUSGENOMMEN.some((r) => r.test(p))) dateien.push(p)
	}
}
lauf(WEB)

const funde = []
for (const datei of dateien) {
	const src = ts.createSourceFile(datei, readFileSync(datei, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const besuche = (n) => {
		let text = null
		if (ts.isJsxText(n)) text = n.text.trim()
		else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text
		else if (ts.isTemplateExpression(n)) text = n.getText()
		const p = n.parent
		const kennung = p && ts.isJsxAttribute(p) && /^data-/.test(p.name.getText())
		const modul = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p))
		if (text && !kennung && !modul && DEUTSCH.test(text)) {
			const { line } = src.getLineAndCharacterOfPosition(n.getStart())
			funde.push(`${relative(ROOT, datei)}:${line + 1}  ${text.replace(/\s+/g, ' ').slice(0, 90)}`)
		}
		ts.forEachChild(n, besuche)
	}
	besuche(src)
}

if (funde.length) {
	console.log(`lang:check — ${funde.length} deutsche Texte ausserhalb von i18n.tsx:\n`)
	for (const f of funde) console.log(`  ${f}`)
	console.log('\nIn i18n.tsx eintragen (EN als Quelle, DE als Uebersetzung) und ueber t.<schluessel> lesen.')
	process.exit(1)
}
console.log(`lang:check ok — ${dateien.length} Dateien, Oberflaechentexte kommen aus i18n.tsx`)
