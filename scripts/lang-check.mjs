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
// Zweiter Teil (2026-09-27): auch englischer Oberflaechentext ausserhalb von
// `t` wird gemeldet. Sechs Ansichten waren fest auf Englisch verdrahtet und
// blieben in der deutschen Einstellung englisch — kein Sprachmix im Code,
// aber einer auf dem Bildschirm. Als Oberflaechentext gilt: JSX-Text,
// `placeholder`/`title`/`aria-label`/`alt`/`label`, Argumente von
// `confirm`/`alert`/`set…Error` und Literale, die ueber `?:`/`||` direkt in
// JSX landen. Fachkuerzel (dB, PTT, VOX, …) stehen in TECHNISCH.
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

// Sprachneutral: Einheiten, Protokolle, Fachkuerzel, Beispieladressen.
const TECHNISCH = /^(dB|PTT|VOX|ON AIR|ETH|WiFi|HTTP|WebSocket \(ws:\/\/\)|ID:|QR…|https:\/\/|ws:\/\/[\d.:]+|[A-Z]{2,5})$/
const ATTRIBUTE = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label'])

/** Landet dieses Literal als sichtbarer Text? */
function sichtbar(n) {
	let p = n.parent
	let kind = n
	// `cond ? "A" : "B"` (nicht die Bedingung) und `x || "A"` / `x ?? "A"`
	while (p && (
		(ts.isConditionalExpression(p) && p.condition !== kind) ||
		(ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)) ||
		ts.isParenthesizedExpression(p)
	)) { kind = p; p = p.parent }
	if (p && ts.isJsxExpression(p)) p = ts.isJsxAttribute(p.parent) ? p.parent : p
	if (ts.isJsxAttribute(p)) return ATTRIBUTE.has(p.name.getText())
	if (ts.isJsxExpression(p)) return true
	if (ts.isCallExpression(p) && kind === n) return /^(confirm|alert|window\.confirm|window\.alert|set\w*(Error|Message|Msg))$/.test(p.expression.getText())
	return false
}

/** Nur der feste Teil eines Template-Literals ist Text; `${…}` kommt von woanders. */
const festerText = (n) => ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ') : n.text
/** Symbole und Emoji tragen keine Sprache. */
const woerter = (text) => text.replace(/[^A-Za-zÄÖÜäöüß0-9:/().\\ -]/gu, ' ').trim()

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
const englisch = []
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
		const stelle = () => `${relative(ROOT, datei)}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1}  ${text.replace(/\s+/g, ' ').slice(0, 90)}`
		if (text && !kennung && !modul && DEUTSCH.test(text)) funde.push(stelle())
		else if (text && !kennung && !modul && (ts.isJsxText(n) || sichtbar(n))) {
			const w = woerter(ts.isJsxText(n) ? text : festerText(n))
			if (/[A-Za-z]{2,}/.test(w) && !TECHNISCH.test(w) && !w.split(/\s*[·:]\s*|\s+/).every((x) => !x || TECHNISCH.test(x) || !/[A-Za-z]{2,}/.test(x))) englisch.push(stelle())
		}
		ts.forEachChild(n, besuche)
	}
	besuche(src)
}

if (englisch.length) {
	console.log(`lang:check — ${englisch.length} unuebersetzte Oberflaechentexte (nicht ueber t):\n`)
	for (const f of englisch) console.log(`  ${f}`)
	console.log('\nIn i18n.tsx eintragen (EN Quelle, DE Uebersetzung) und ueber t.<schluessel> lesen; Fachkuerzel in TECHNISCH.')
}
if (funde.length) {
	console.log(`lang:check — ${funde.length} deutsche Texte ausserhalb von i18n.tsx:\n`)
	for (const f of funde) console.log(`  ${f}`)
	console.log('\nIn i18n.tsx eintragen (EN als Quelle, DE als Uebersetzung) und ueber t.<schluessel> lesen.')
}
if (funde.length || englisch.length) process.exit(1)
console.log(`lang:check ok — ${dateien.length} Dateien, Oberflaechentexte kommen aus i18n.tsx`)
