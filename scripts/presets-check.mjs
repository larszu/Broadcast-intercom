#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die Companion-Tasten kommen aus dem Plan (Bedarf 3).
//
// WARUM ES DAS GIBT. `companion-module/test/integration.mjs` braucht einen
// laufenden Kern UND eine Companion-Installation; die Ableitung der Tasten
// braucht beides nicht. Ohne diesen Lauf waere die einzige Pruefung der
// Tastenableitung eine, die in CI nicht stattfindet — und eine Pruefung, die
// nicht laeuft, ist keine.
//
// Geprueft wird die REINE Ableitung (`presetPlan.js`) plus die Verdrahtung im
// Modul, letztere als Quelltext: `getPresets` muss die Instanz bekommen, und
// `onStateUpdate` muss die Tasten mit erneuern. Genau das fehlte — die Tasten
// waren die einzige der vier Definitionslisten, die nach `init()` nie wieder
// angefasst wurde.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { derivePresets, buttonLabel, safeKey, MAX_PER_KIND } from '../companion-module/src/presetPlan.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

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

// ── Zustand wie ihn der Kern liefert ───────────────────────────────────────
const state = {
	devices: {
		bp1: { id: 'bp1', label: 'Kamera 1', channelIds: ['prod'] },
		bp2: { id: 'bp2', label: 'Ton FOH', channelIds: ['prod', 'ton'] },
		bp3: { id: 'bp3', label: 'Ohne Kanal', channelIds: [] },
	},
	channels: {
		prod: { id: 'prod', name: 'Produktion' },
		ton: { id: 'ton', name: 'Ton' },
	},
}

const { presets, omitted } = derivePresets(state)

console.log('Bedarf 3 — Tasten aus dem Plan')

check('je Sprechstelle eine PTT-Taste', Boolean(presets.plan_ptt_bp1 && presets.plan_ptt_bp2))
check(
	'die PTT-Taste ist AUSGEFUELLT, nicht leer wie die Vorlage',
	presets.plan_ptt_bp1.steps[0].down[0].options.device === 'bp1',
	JSON.stringify(presets.plan_ptt_bp1?.steps?.[0]?.down?.[0]?.options),
)
check(
	'PTT haelt, statt umzuschalten (haengendes Toggle = offenes Mikrofon)',
	// Mit `?.`: faellt der Loslass-Schritt weg, soll hier ein FAIL stehen und
	// kein Stapelabzug. Ein abgestuerzter Pruefer sagt zwar auch „rot", aber
	// nicht, WAS rot ist.
	presets.plan_ptt_bp1?.steps?.[0]?.down?.[0]?.options?.mode === 'press' &&
		presets.plan_ptt_bp1?.steps?.[0]?.up?.[0]?.options?.mode === 'release',
	'ohne Loslass-Schritt bleibt das Mikrofon offen',
)
check(
	'das Feedback zeigt DIESE Sprechstelle',
	presets.plan_ptt_bp1.feedbacks[0].options.device === 'bp1',
)
check(
	'der volle Name steht im Preset-Namen, die Kurzform auf der Taste',
	presets.plan_ptt_bp1.name.includes('Kamera 1') && presets.plan_ptt_bp1.style.text.includes('Kamera 1'),
)

check(
	'je gefuehrtem Kanal eine Sprechtaste',
	Boolean(presets.plan_talk_prod_bp1 && presets.plan_talk_prod_bp2 && presets.plan_talk_ton_bp2),
)
check(
	'die Kanal-Taste nennt Kanal UND Sprechstelle',
	presets.plan_talk_ton_bp2.steps[0].down[0].options.channel === 'ton' &&
		presets.plan_talk_ton_bp2.steps[0].down[0].options.device === 'bp2',
)
check(
	'KEINE Kanal-Taste fuer eine Sprechstelle, die den Kanal nicht fuehrt',
	presets.plan_talk_ton_bp1 === undefined,
	'bp1 fuehrt nur „prod" — eine geratene Sprechtaste schaltet das falsche Mikrofon auf den falschen Kanal',
)
check(
	'eine Sprechstelle ohne Kanal bekommt PTT, aber keine Kanal-Taste',
	Boolean(presets.plan_ptt_bp3) && !Object.keys(presets).some((k) => k.endsWith('_bp3') && k.startsWith('plan_talk')),
)

check('nichts ausgelassen bei drei Sprechstellen', omitted.devices === 0 && omitted.channels === 0)

// ── Ohne Zustand: die Vorlagen bleiben, es kracht nicht ────────────────────
const leer = derivePresets(undefined)
check('ohne Kern-Zustand entstehen keine abgeleiteten Tasten', Object.keys(leer.presets).length === 0)
check('ohne Kern-Zustand kracht es nicht', leer.omitted.devices === 0)

// ── Obergrenze wird GESAGT, nicht verschwiegen ─────────────────────────────
const viele = { devices: {}, channels: {} }
for (let i = 0; i < MAX_PER_KIND + 5; i++) {
	viele.devices[`d${i}`] = { id: `d${i}`, label: `Gerät ${i}`, channelIds: [] }
}
const gross = derivePresets(viele)
check(
	'ueber der Obergrenze wird die Zahl der ausgelassenen genannt',
	gross.omitted.devices === 5,
	`omitted.devices=${gross.omitted.devices}`,
)

// ── Kleinkram, der im Betrieb weh tut ──────────────────────────────────────
check('Preset-Schluessel enthalten nur erlaubte Zeichen', safeKey('bp/1 a') === 'bp_1_a')
check('zu langer Text wird sichtbar gekuerzt', buttonLabel('Kamera 1 Beltpack links').endsWith('…'))
check('kurzer Text bleibt unangetastet', buttonLabel('Ton FOH') === 'Ton FOH')

// ── Verdrahtung im Modul ───────────────────────────────────────────────────
const indexSrc = read('companion-module/src/index.js')
const presetsSrc = read('companion-module/src/presets.js')

check(
	'`getPresets` bekommt an BEIDEN Stellen die Instanz',
	// Beide, nicht irgendeine: die erste Fassung dieser Pruefung suchte nur ein
	// Vorkommen und blieb gruen, als die Gegenprobe `init()` auf `getPresets()`
	// zurueckdrehte — der Aufruf in `onStateUpdate` deckte sie zu.
	(indexSrc.match(/setPresetDefinitions\(getPresets\(this\)\)/g) || []).length === 2,
	`gefunden: ${(indexSrc.match(/setPresetDefinitions\(getPresets\(this\)\)/g) || []).length}`,
)
check(
	'die Tasten werden bei Topologie-Aenderung ERNEUERT, nicht nur in init() gesetzt',
	// Zaehlen statt suchen: einmal in `init`, einmal in `onStateUpdate`. Bis
	// Bedarf 3 stand der Aufruf nur an EINER Stelle, und genau daran lag es.
	(indexSrc.match(/setPresetDefinitions\(/g) || []).length === 2,
	`gefunden: ${(indexSrc.match(/setPresetDefinitions\(/g) || []).length}`,
)
check(
	'die Vorlagen bleiben neben den abgeleiteten stehen',
	presetsSrc.includes('presets.ptt_hold') && presetsSrc.includes('derivePresets(state)'),
)
check(
	'Farben werden erst im Modul zu Companion-Zahlen',
	// Geprueft wird die IMPORT-ZEILE, nicht das Vorkommen der Zeichenkette:
	// der Paketname steht im Kopfkommentar der Datei, und die erste Fassung
	// dieser Pruefung ist ueber genau diesen Kommentar gestolpert.
	!/^\s*import\b[^\n]*@companion-module\//m.test(read('companion-module/src/presetPlan.js')),
	'die Ableitung muss ohne Companion-Installation laufen',
)

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
