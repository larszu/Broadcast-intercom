#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Eine Rechnung fuer den Mikrofon-Pegel, eine fuer PCM.
//
// BEFUND (Defektformen-Sweep, Form `zwei-rechnungen`). `Softclient.tsx` und
// `PhoneClient.tsx` sind zwei Ansichten derselben App am selben Kern und
// hatten drei Rechnungen doppelt: `downsampleToInt16` und `int16ToBase64`
// Zeile fuer Zeile, und den Mikrofon-Pegel mit ZWEI verschiedenen Formeln —
// Spektrum-Mittel gegen Zeitbereichs-RMS —, beide als „%" auf demselben
// Balken. Der Softclient vergleicht seine VOX-Schwelle gegen diese Zahl;
// wer den Pegel am Telefon ablas und die Schwelle danach setzte, bekam ein
// Mikrofon, das nie aufmacht.
//
// WAS DIESER LAUF PRUEFT:
//
//   1. Das VERHALTEN der einen Funktion — Stille, Vollausschlag, Monotonie,
//      Herunterrechnen, Base64.
//   2. Dass die beiden alten Formeln auf demselben Signal WIRKLICH weit
//      auseinanderliegen. Das ist die Begruendung des Befundes, nicht der
//      Fix: waeren sie gleich, waere die ganze Zusammenlegung Kosmetik.
//   3. Quelltext: keine der beiden Ansichten rechnet noch selbst.
//
// Der Lauf importiert `apps/web/src/lib/audio.ts` direkt — Node 22 zieht die
// Typen beim Laden ab, es braucht also keinen Build und keinen Bundler.
//
// Lauf: `npm run audio:check`
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mikrofonPegel, downsampleToInt16, int16ToBase64 } from '../apps/web/src/lib/audio.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p) => readFileSync(join(ROOT, p), 'utf8')

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

// ── Hilfsmittel: ein Zeitbereichs-Puffer mit gegebener Amplitude ───────────
/** Sinus mit Amplitude `a` (0..1), so wie `getByteTimeDomainData` ihn liefert. */
const zeitbereich = (a, n = 2048) => {
	const d = new Uint8Array(n)
	for (let i = 0; i < n; i += 1) {
		d[i] = Math.max(0, Math.min(255, Math.round(128 + a * 127 * Math.sin((2 * Math.PI * i * 8) / n))))
	}
	return d
}

console.log('Mikrofon-Pegel — eine Rechnung')

check('Stille ist 0 %', mikrofonPegel(zeitbereich(0)) === 0)
check('ein leerer Puffer kracht nicht und ist 0 %', mikrofonPegel(new Uint8Array(0)) === 0)
check(
	'Vollausschlag erreicht die Obergrenze',
	mikrofonPegel(zeitbereich(1)) === 100,
	`gemessen ${mikrofonPegel(zeitbereich(1))}`,
)
check(
	'lauter ist nie kleiner als leiser',
	[0.1, 0.2, 0.4, 0.8].every((a, i, arr) => i === 0 || mikrofonPegel(zeitbereich(a)) >= mikrofonPegel(zeitbereich(arr[i - 1]))),
)
check(
	'doppelte Amplitude liest sich doppelt so hoch',
	// DIESE Zusicherung fehlte zuerst, und die Gegenprobe hat es gezeigt: mit
	// `rms = summeQuadrate / n` — also der Wurzel unterschlagen — blieb der
	// Lauf gruen. Ein Quadrat ist aber kein Pegel: leise Sprache faellt damit
	// fast auf null, und die VOX-Schwelle wird unbrauchbar. Der Unterschied
	// ist genau die Kennlinie, nicht der Einzelwert.
	(() => {
		const leise = mikrofonPegel(zeitbereich(0.1))
		const laut = mikrofonPegel(zeitbereich(0.2))
		const faktor = laut / leise
		return faktor > 1.8 && faktor < 2.2
	})(),
	`0.1 -> ${mikrofonPegel(zeitbereich(0.1))} %, 0.2 -> ${mikrofonPegel(zeitbereich(0.2))} %`,
)
check(
	'normale Sprache liegt im ablesbaren Bereich, nicht am Anschlag',
	// Ohne diese Zusicherung koennte die Dehnung so gross sein, dass jeder
	// Ton 100 % zeigt — ein Balken, der immer voll ist, sagt nichts.
	(() => {
		const p = mikrofonPegel(zeitbereich(0.2))
		return p > 5 && p < 95
	})(),
	`0.2 Amplitude -> ${mikrofonPegel(zeitbereich(0.2))} %`,
)

// ── Die Begruendung: die beiden alten Formeln waren NICHT dieselbe Groesse ──
console.log('\nDie beiden alten Formeln')

/** Die alte Softclient-Formel, hier nur zum Vergleich nachgebaut. */
const altSoftclient = (spektrum) => {
	const avg = spektrum.reduce((a, b) => a + b, 0) / spektrum.length
	return Math.min(100, Math.round((avg / 255) * 100))
}

// Ein Spektrum, wie es bei Sprache aussieht: wenige laute Bins, der Rest
// nahe null. Genau daran scheiterte das Mittel ueber alle Bins.
const sprachSpektrum = new Uint8Array(128)
for (let i = 0; i < sprachSpektrum.length; i += 1) sprachSpektrum[i] = i < 12 ? 220 : 6
const alt = altSoftclient(sprachSpektrum)
const neu = mikrofonPegel(zeitbereich(0.5))
check(
	'Spektrum-Mittel und Zeitbereichs-RMS liegen um mehr als Faktor 2 auseinander',
	neu > alt * 2,
	`alt ${alt} % gegen neu ${neu} % — waeren sie gleich, waere die Zusammenlegung Kosmetik`,
)

// ── PCM: dieselbe Rechnung fuer beide Ansichten ────────────────────────────
console.log('\nPCM')

const gleicheRate = downsampleToInt16(Float32Array.from([0, 1, -1, 0.5]), 48000, 48000)
check('gleiche Rate laesst die Laenge unangetastet', gleicheRate.length === 4)
check('1.0 wird der groesste positive Wert', gleicheRate[1] === 0x7fff)
check('-1.0 wird der kleinste negative Wert', gleicheRate[2] === -0x8000)
check(
	'ueber 1.0 wird geklemmt, nicht umgeklappt',
	// Ohne Klemmung laeuft der Int16 ueber und aus dem lautesten Ton wird der
	// leiseste — ein Knacken, das nach kaputtem Mikrofon klingt.
	downsampleToInt16(Float32Array.from([2, -2]), 48000, 48000)[0] === 0x7fff &&
		downsampleToInt16(Float32Array.from([2, -2]), 48000, 48000)[1] === -0x8000,
)

const runter = downsampleToInt16(new Float32Array(4800), 48000, 16000)
check('48 kHz auf 16 kHz ergibt ein Drittel der Abtastwerte', runter.length === 1600, `${runter.length}`)
check(
	'gemittelt wird ueber das Fenster, nicht der Nachbar abgegriffen',
	// Eingang springt zwischen +1 und -1; ein Abgreifen liefert +-0x7fff,
	// ein Mittel ueber drei Werte liegt nahe null.
	(() => {
		const wechsel = Float32Array.from({ length: 4800 }, (_, i) => (i % 2 === 0 ? 1 : -1))
		const out = downsampleToInt16(wechsel, 48000, 16000)
		return Math.abs(out[10]) < 0x4000
	})(),
)

check('Base64 kommt unveraendert zurueck', (() => {
	const pcm = Int16Array.from([0, 1, -1, 12345])
	const zurueck = new Int16Array(Uint8Array.from(atob(int16ToBase64(pcm)), (c) => c.charCodeAt(0)).buffer)
	return zurueck.length === pcm.length && zurueck.every((v, i) => v === pcm[i])
})())

// ── Keine der beiden Ansichten rechnet noch selbst ─────────────────────────
console.log('\nVerdrahtung')

for (const datei of ['apps/web/src/views/Softclient.tsx', 'apps/web/src/views/PhoneClient.tsx']) {
	const src = lies(datei)
	check(`${datei} holt die Rechnung aus lib/audio`, /from ["']\.\.\/lib\/audio["']/.test(src))
	check(
		`${datei} definiert downsampleToInt16 nicht selbst`,
		!/function downsampleToInt16\s*\(/.test(src),
	)
	check(
		`${datei} definiert int16ToBase64 nicht selbst`,
		!/function int16ToBase64\s*\(/.test(src),
	)
	check(
		`${datei} rechnet den Pegel nicht selbst`,
		// Beide alten Formeln auf einmal: die eine erkennt man am
		// Spektrum-Abgriff, die andere an der nackten Dehnungszahl.
		!src.includes('getByteFrequencyData') && !/rms\s*\*\s*400/.test(src),
	)
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
