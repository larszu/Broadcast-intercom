#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die Konfiguration ueberlebt einen Absturz waehrend des Speicherns.
//
// BEFUND (Defektformen-Sweep, Form `zustand-nach-fehler`). `saveConfig`
// schrieb mit einem blanken `fs.writeFile` direkt auf die Zieldatei. Faellt
// der Rechner dabei aus — Strom weg, Deckel zu, `kill` beim Herunterfahren —,
// steht dort eine halbe Datei. Beim naechsten Start warf `JSON.parse`, und
// `initializeState` hatte dafuer keinen Zweig: der Kern startete nicht mehr.
//
// Gespeichert wird bei jeder Konfigurationsaenderung und bei jedem
// uebernommenen Intercom-Plan, also waehrend des Aufbaus — genau dann, wenn
// Laptops zugeklappt und Steckdosen umgesteckt werden. Und es trifft die
// Datei, in der das ganze System steht: Geraete, Kanaele, Rechte, Matrix.
//
// WAS DIESER LAUF PRUEFT — das VERHALTEN, nicht den Quelltext:
//
//   1. `atomicWrite` schreibt und dreht die vorherige Fassung nach `.bak`.
//   2. Ein Absturz VOR dem `rename` laesst die Zieldatei unangetastet — das
//      ist der Kern: die halbe Datei landet nie unter dem richtigen Namen.
//   3. `readWithBackup` faellt auf die Sicherung zurueck und MELDET das.
//   4. Sind beide kaputt, wirft es — der Aufrufer entscheidet, was ein
//      leerer Anfang kostet, nicht diese Schicht.
//
// Dazu zwei Quelltext-Zusicherungen, weil sie die Verdrahtung betreffen und
// nicht die Rechnung: `saveConfig` benutzt keinen blanken `fs.writeFile`
// mehr, und `initializeState` faengt den unlesbaren Fall ab, ohne zu
// speichern.
//
// Lauf: `npm run config:check`
// ───────────────────────────────────────────────────────────────────────────
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicWrite, readWithBackup, bakPath, tmpPath } from '../apps/server/dist/configStore.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p) => readFile(join(ROOT, p), 'utf8')

let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
	if (cond) {
		pass++
		console.log(`  PASS  ${name}`)
	} else {
		fail++
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

const dir = await mkdtemp(join(tmpdir(), 'intercom-config-'))
const ziel = join(dir, 'default.json')

try {
	// ── 1. Schreiben und Drehen ───────────────────────────────────────────
	await atomicWrite(ziel, '{"v":1}')
	check('erster Schreibvorgang legt die Datei an', await readFile(ziel, 'utf8') === '{"v":1}')
	check('ohne Vorgaenger gibt es keine Sicherung',
		!(await readdir(dir)).includes('default.json.bak'))

	await atomicWrite(ziel, '{"v":2}')
	check('zweiter Schreibvorgang ersetzt die Datei', await readFile(ziel, 'utf8') === '{"v":2}')
	check('die vorherige Fassung steht als Sicherung',
		await readFile(bakPath(ziel), 'utf8') === '{"v":1}')

	check('keine tmp-Datei bleibt liegen',
		!(await readdir(dir)).includes('default.json.tmp'))

	// ── 2. Der Absturz vor dem rename ─────────────────────────────────────
	//
	// Das ist der eigentliche Punkt. Genau so sah es vorher aus, nur dass die
	// halbe Datei unter dem RICHTIGEN Namen stand.
	await writeFile(tmpPath(ziel), '{"v":3', 'utf8')
	check('eine halbe tmp-Datei laesst das Ziel unangetastet',
		await readFile(ziel, 'utf8') === '{"v":2}',
		'der Abbruch vor dem rename darf die gueltige Datei nicht beruehren')
	await rm(tmpPath(ziel))

	// ── 3. Rueckfall auf die Sicherung ────────────────────────────────────
	await writeFile(ziel, '{"v":3', 'utf8')   // kaputt, wie nach einem Absturz
	const r = await readWithBackup(ziel, (raw) => JSON.parse(raw))
	check('eine kaputte Hauptdatei faellt auf die Sicherung zurueck', r.source === 'sicherung')
	check('der geladene Stand ist der der Sicherung', r.value.v === 1)
	check('der Rueckfall wird gemeldet', typeof r.warnung === 'string' && r.warnung.length > 0)
	check('die kaputte Datei bleibt liegen', await readFile(ziel, 'utf8') === '{"v":3')

	// ── 4. Beides kaputt: werfen, nicht raten ─────────────────────────────
	await writeFile(bakPath(ziel), 'auch kaputt', 'utf8')
	let geworfen = false
	try {
		await readWithBackup(ziel, (raw) => JSON.parse(raw))
	} catch {
		geworfen = true
	}
	check('sind beide kaputt, wirft die Leseschicht', geworfen,
		'ein stiller leerer Stand waere die zweite Haelfte desselben Verlusts')
} finally {
	await rm(dir, { recursive: true, force: true })
}

// ── 5. Die Verdrahtung ────────────────────────────────────────────────────
const server = await lies('apps/server/src/index.ts')
check('saveConfig schreibt nicht mehr direkt',
	!/fs\.writeFile\(configFilePath/.test(server),
	'ein blankes fs.writeFile auf die Zieldatei ist genau der Defekt')
check('saveConfig benutzt atomicWrite',
	/atomicWrite\(configFilePath\(target\)/.test(server))
check('initializeState faengt die unlesbare Datei ab',
	/state = createInitialState\(items\[0\]\.name\)/.test(server))
// Nur der Rueckfall-Zweig, nicht der `else`-Zweig daneben: dort ist ein
// saveConfig richtig (es gibt noch gar keine Datei). Der Ausschnitt reicht
// vom Ersatz-Zustand bis zum `} else {`.
const anfang = server.indexOf('state = createInitialState(items[0].name)')
const ende = server.indexOf('} else {', anfang)
const rueckfall = anfang >= 0 && ende > anfang ? server.slice(anfang, ende) : ''
check('und speichert dabei NICHT', rueckfall.length > 0 && !rueckfall.includes('saveConfig'),
	'ein automatisches Ueberschreiben vernichtet den Beleg')

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
