#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Lautstaerke und Stumm an ihrer Grenze.
//
// BEFUND (Defektformen-Sweep, Form `fixture-erreicht-grenze-nicht`, gemessen
// 2026-09-08). Der Kern kennt `mute_input`, `mute_output`, `volume_up` und
// `volume_down`. Der Smoke-Test — 58 Pruefungen — beruehrt KEINE davon. Die
// Grenze, an der sie sich treffen (-60 dB), ist deshalb nie erreicht worden,
// und dort steckten zwei Fehler:
//
//   1. STUMM WAR EINE EINBAHNSTRASSE. `mute_input` setzte `inputGainDb = -60`
//      und das war alles. Kein `unmute`, und fuer den Eingang auch kein
//      `volume_up`. Wer auf seiner Companion-Taste das eigene Mikrofon stumm
//      schaltet, bekommt es nur ueber die Weboberflaeche und den
//      Schieberegler zurueck — mitten in einer Sendung.
//
//   2. -60 dB HIESS ZWEIERLEI: Stumm-Wert UND unteres Ende des
//      Lautstaerkebereichs. `volume_down` oft genug gedrueckt landet auf
//      exakt -60 und ist damit „stumm"; `volume_up` danach fuehrt auf -57 dB
//      — hoerbar, aber fast aus — statt dorthin, wo der Pegel vorher war.
//
// Der Lauf faehrt die Grenze WIRKLICH ab: von der Vorgabe bis an beide Enden,
// in Dreier-Schritten, und wieder zurueck.
//
// Lauf: `npm run audio:control`
// ───────────────────────────────────────────────────────────────────────────
import {
	applyAudioControl,
	AUDIO_GAIN_MIN_DB,
	AUDIO_GAIN_MAX_DB,
	AUDIO_GAIN_STEP_DB,
	AUDIO_CONTROL_ACTIONS,
	isAudioControlAction,
} from '../packages/shared/src/index.ts'

let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
	if (cond) { pass++; console.log(`  PASS  ${name}`) }
	else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const audio = (over = {}) => ({
	inputGainDb: 0, outputGainDb: 2, sidetonePercent: 20,
	noiseGateDb: -45, limiterEnabled: true, ...over,
})
const nach = (start, ...aktionen) => aktionen.reduce((a, x) => applyAudioControl(a, x, 2), start)

console.log('Stumm hat einen Weg zurueck')

{
	const stumm = applyAudioControl(audio(), 'mute_output', 2)
	check('stumm setzt auf die Untergrenze', stumm.outputGainDb === AUDIO_GAIN_MIN_DB)
	check('… und merkt sich, wo es herkam', stumm.preMuteOutputGainDb === 2)

	const zurueck = applyAudioControl(stumm, 'mute_output', 2)
	check('dieselbe Taste macht wieder laut', zurueck.outputGainDb === 2,
		`gemessen ${zurueck.outputGainDb}`)
	check('… und der Merker ist weg', zurueck.preMuteOutputGainDb === undefined)
}

{
	const stumm = applyAudioControl(audio({ inputGainDb: 6 }), 'mute_input', 2)
	check('auch der Eingang laesst sich stumm schalten', stumm.inputGainDb === AUDIO_GAIN_MIN_DB)
	const zurueck = applyAudioControl(stumm, 'unmute_input', 2)
	check('und ausdruecklich wieder aufmachen', zurueck.inputGainDb === 6)
	check('der Ausgang bleibt dabei unberuehrt', zurueck.outputGainDb === 2)
}

{
	// Ohne Merker (frisch geladene Konfiguration, in der -60 steht) faellt es
	// auf die Vorgabe des Transports zurueck — nicht auf 0 und nicht auf
	// „bleibt stumm".
	const zurueck = applyAudioControl(audio({ outputGainDb: -60 }), 'unmute_output', 2)
	check('ohne Merker gilt die Vorgabe des Transports', zurueck.outputGainDb === 2)
}

{
	// Dreimal dieselbe Taste: stumm, laut, stumm. Der Pegel muss beim dritten
	// Druck WIEDER gemerkt sein — sonst waere der Weg zurueck nach dem zweiten
	// Umschalten verloren, und genau das faellt erst in der Sendung auf.
	const a = audio({ outputGainDb: 9 })
	const s1 = applyAudioControl(a, 'mute_output', 2)
	const l1 = applyAudioControl(s1, 'mute_output', 2)
	const s2 = applyAudioControl(l1, 'mute_output', 2)
	const l2 = applyAudioControl(s2, 'mute_output', 2)
	check('stumm/laut/stumm/laut landet wieder auf demselben Pegel',
		l1.outputGainDb === 9 && l2.outputGainDb === 9,
		`${l1.outputGainDb} / ${l2.outputGainDb}`)
	check('… und merkt sich zwischendurch jedesmal neu', s2.preMuteOutputGainDb === 9)
}

console.log('\nDie Grenze wird wirklich abgefahren')

{
	// Vom Vorgabewert bis an die Obergrenze und einen Schritt darueber.
	let a = audio()
	const schritte = Math.ceil((AUDIO_GAIN_MAX_DB - a.outputGainDb) / AUDIO_GAIN_STEP_DB) + 2
	for (let i = 0; i < schritte; i++) a = applyAudioControl(a, 'volume_up', 2)
	check('lauter endet exakt an der Obergrenze', a.outputGainDb === AUDIO_GAIN_MAX_DB,
		`gemessen ${a.outputGainDb} nach ${schritte} Schritten`)

	let b = audio()
	const runter = Math.ceil((b.outputGainDb - AUDIO_GAIN_MIN_DB) / AUDIO_GAIN_STEP_DB) + 2
	for (let i = 0; i < runter; i++) b = applyAudioControl(b, 'volume_down', 2)
	check('leiser endet exakt an der Untergrenze', b.outputGainDb === AUDIO_GAIN_MIN_DB,
		`gemessen ${b.outputGainDb} nach ${runter} Schritten`)

	// Und der Fall, um den es geht: ganz heruntergedreht ist NICHT stumm mit
	// Merker — ein Schritt nach oben fuehrt einen Schritt nach oben.
	const wieder = applyAudioControl(b, 'volume_up', 2)
	check('von ganz unten fuehrt lauter einen Schritt nach oben',
		wieder.outputGainDb === AUDIO_GAIN_MIN_DB + AUDIO_GAIN_STEP_DB,
		`gemessen ${wieder.outputGainDb}`)
}

{
	// Eine ausdrueckliche Aenderung vergisst den Merker — sonst springt ein
	// spaeteres „wieder laut" auf einen Pegel, den niemand mehr erwartet.
	const stumm = applyAudioControl(audio({ outputGainDb: 9 }), 'mute_output', 2)
	const nachHand = applyAudioControl(stumm, 'volume_up', 2)
	check('lauter vergisst den Merker', nachHand.preMuteOutputGainDb === undefined)
	check('… und geht von dort weiter, wo es steht',
		nachHand.outputGainDb === AUDIO_GAIN_MIN_DB + AUDIO_GAIN_STEP_DB)
}

console.log('\nKleinkram, der im Betrieb weh tut')

check('nichts wird an Ort und Stelle veraendert', (() => {
	const a = audio()
	applyAudioControl(a, 'mute_output', 2)
	return a.outputGainDb === 2 && a.preMuteOutputGainDb === undefined
})())

check('die anderen Felder bleiben, wie sie waren', (() => {
	const a = nach(audio(), 'mute_output', 'volume_up', 'mute_input')
	return a.sidetonePercent === 20 && a.noiseGateDb === -45 && a.limiterEnabled === true
})())

check('jede Aktion der Liste ist auch als Aktion erkannt',
	AUDIO_CONTROL_ACTIONS.every((a) => isAudioControlAction(a)))
check('etwas anderes nicht', !isAudioControlAction('ptt_start'))

console.log('\nDer Kern benutzt die eine Regel')

const { readFileSync } = await import('node:fs')
const server = readFileSync(new URL('../apps/server/src/index.ts', import.meta.url), 'utf8')
const code = server.split('\n').filter((z) => !z.trimStart().startsWith('//')).join('\n')
check('`applyAudioControl` wird aufgerufen', code.includes('applyAudioControl('))
check('der Kern rechnet die Pegel nicht mehr selbst', !/outputGainDb\s*=\s*Math\.max/.test(code))
check('und setzt -60 nicht mehr von Hand', !/(input|output)GainDb\s*=\s*-60/.test(code))

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
