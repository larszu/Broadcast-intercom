// ───────────────────────────────────────────────────────────────────────────
// Tasten aus dem Plan, nicht aus der Zwischenablage (Bedarf 3, P1).
//
// WAS DER BEDARF SAGT:
//
//   > Reusable, callable action sequences ('functions') for the control
//   > surface instead of copy-pasting near-identical buttons per show
//   > variant. […] Each show variant is built by duplicating and hand-tweaking
//   > buttons that differ by one or two actions; weekly shows pay this 52
//   > times a year.
//
// Und der Weg: „so the surface is derived, not retyped".
//
// WAS VORHER PASSIERTE. `getPresets()` gab acht Vorlagen zurueck — alle mit
// `device: ''`, also unausgefuellt. Der Operator zog eine PTT-Taste auf die
// Oberflaeche und suchte danach im Dropdown die Sprechstelle heraus, fuer
// jede Sprechstelle einzeln, bei jeder Show neu. Schlimmer noch: die Vorlagen
// wurden EINMAL in `init()` gesetzt, vor der ersten Verbindung, und bei
// `onStateUpdate` nicht erneuert. Aktionen, Feedbacks und Variablen wurden
// dort nachgezogen — die Tasten nicht. Sie konnten also nie etwas ueber den
// geladenen Plan wissen, selbst wenn sie gewollt haetten.
//
// WAS JETZT GILT. Diese Datei leitet aus dem KERN-ZUSTAND (der den Plan
// traegt, siehe B-41.2) eine fertige Taste je Sprechstelle und je Kanal ab.
// Die Vorlagen bleiben daneben stehen: wer keinen Kern erreicht, muss weiter
// von Hand bauen koennen, und eine leere Preset-Liste waere eine
// Verschlechterung fuer genau den Fall.
//
// WARUM DIE DATEI KEIN `@companion-module/base` IMPORTIERT. Damit sie
// pruefbar ist. Das Paket liegt nur im Modul-Verzeichnis, nicht im
// Arbeitsbereich; eine Ableitung, die es importiert, laesst sich in CI nicht
// ohne Companion-Installation ausfuehren. Die Farben stehen deshalb als NAMEN
// hier und werden erst in `presets.js` zu `combineRgb`-Zahlen. Dieselbe
// Trennung wie zwischen Ableitung und Oberflaeche im Planer.
//
// KEIN STILLES ABSCHNEIDEN. Wer mehr Sprechstellen hat, als hier Tasten
// entstehen, erfaehrt es: `derivePresets` gibt die Zahl der ausgelassenen
// zurueck, und der Aufrufer schreibt sie ins Log. Eine Liste, die bei 64
// aufhoert und nichts sagt, sieht aus wie „das sind alle".
// ───────────────────────────────────────────────────────────────────────────

/** Farbnamen statt Zahlen — `presets.js` loest sie auf. */
export const COLOURS = {
	black: [0, 0, 0],
	white: [255, 255, 255],
	dark: [20, 20, 20],
	green: [0, 170, 80],
	red: [200, 30, 30],
}

/**
 * Obergrenze je Gattung. Companion zeigt Presets in einer Liste; einige
 * hundert Eintraege machen sie unbenutzbar, und ein Kern mit 200 Sprechstellen
 * ist moeglich. Wird sie erreicht, sagt der Rueckgabewert es — abgeschnitten
 * wird nichts stillschweigend.
 */
export const MAX_PER_KIND = 64

/** Companion-Preset-Schluessel: Buchstaben, Ziffern, Unterstrich. */
export const safeKey = (id) => String(id).replace(/[^a-zA-Z0-9]+/g, '_')

/**
 * Der Text auf der Taste. Companion-Tasten sind klein; ein Label wie
 * „Kamera 1 (Beltpack links)" passt nicht.
 *
 * Abgeschnitten wird mit einem Auslassungszeichen, damit man SIEHT, dass es
 * weitergeht — und der volle Text steht im `name` des Presets, also in der
 * Liste, aus der der Operator zieht. Beides zusammen: kurz auf der Taste,
 * vollstaendig beim Auswaehlen.
 */
export const buttonLabel = (text, max = 12) => {
	const t = String(text ?? '').trim()
	if (t.length <= max) return t
	return `${t.slice(0, max - 1)}…`
}

/**
 * Die abgeleiteten Tasten.
 *
 * Eingabe ist der rohe Kern-Zustand (`devices`, `channels` als Objekte oder
 * Listen), damit diese Funktion ohne Companion und ohne laufenden Kern
 * pruefbar bleibt.
 *
 * Rueckgabe: `{ presets, omitted }`. `presets` ist ein Objekt Schluessel →
 * Preset in derselben Form, die `setPresetDefinitions` erwartet, nur mit
 * Farbnamen. `omitted` sagt je Gattung, wie viele nicht aufgenommen wurden.
 */
export function derivePresets(state) {
	const devices = toList(state?.devices)
	const channels = toList(state?.channels)
	const presets = {}
	const omitted = { devices: Math.max(0, devices.length - MAX_PER_KIND), channels: 0 }

	for (const d of devices.slice(0, MAX_PER_KIND)) {
		const k = safeKey(d.id)
		const label = d.label || d.id
		presets[`plan_ptt_${k}`] = {
			type: 'button',
			category: 'Plan · Sprechstellen',
			name: `PTT — ${label}`,
			style: {
				text: `${buttonLabel(label)}\\nPTT`,
				size: '14',
				color: 'white',
				bgcolor: 'dark',
			},
			steps: [
				{
					// Halten statt Umschalten: die Sprechtaste einer Sprechstelle
					// ist im Betrieb eine Halte-Taste, und ein haengengebliebenes
					// Toggle ist ein offenes Mikrofon in der Regie.
					down: [{ actionId: 'ptt', options: { device: d.id, slot: 0, mode: 'press' } }],
					up: [{ actionId: 'ptt', options: { device: d.id, slot: 0, mode: 'release' } }],
				},
			],
			feedbacks: [
				{
					feedbackId: 'device_talking',
					options: { device: d.id, channel: 'any' },
					style: { bgcolor: 'green', color: 'black' },
				},
			],
		}
		presets[`plan_mute_${k}`] = {
			type: 'button',
			category: 'Plan · Sprechstellen',
			name: `Mikro stumm — ${label}`,
			style: {
				text: `${buttonLabel(label)}\\nMUTE`,
				size: '14',
				color: 'white',
				bgcolor: 'dark',
			},
			steps: [
				{ down: [{ actionId: 'mute', options: { device: d.id, direction: 'input', mode: 'mute' } }], up: [] },
				{ down: [{ actionId: 'mute', options: { device: d.id, direction: 'input', mode: 'unmute' } }], up: [] },
			],
			feedbacks: [
				{
					feedbackId: 'device_muted',
					options: { device: d.id, direction: 'input' },
					style: { bgcolor: 'red', color: 'white' },
				},
			],
		}
	}

	// Kanal-Tasten brauchen BEIDES: den Kanal und die Sprechstelle, die auf ihm
	// spricht. Die Sprechstelle steht nicht im Kanal — deshalb entsteht je Kanal
	// eine Taste je Sprechstelle, DIE DEN KANAL FUEHRT. Ein Kreuzprodukt ueber
	// alle Sprechstellen waere eine Tastenwand, in der die richtige nicht mehr
	// zu finden ist.
	let channelPresets = 0
	for (const c of channels) {
		const sprecher = devices.filter((d) => channelIds(d).includes(c.id))
		for (const d of sprecher) {
			if (channelPresets >= MAX_PER_KIND) {
				omitted.channels += 1
				continue
			}
			channelPresets += 1
			const label = c.name || c.id
			presets[`plan_talk_${safeKey(c.id)}_${safeKey(d.id)}`] = {
				type: 'button',
				category: 'Plan · Kanäle',
				name: `Sprechen auf ${label} — ${d.label || d.id}`,
				style: {
					text: `${buttonLabel(label)}\\n${buttonLabel(d.label || d.id, 8)}`,
					size: '14',
					color: 'white',
					bgcolor: 'dark',
				},
				steps: [
					{
						down: [
							{ actionId: 'talk_channel', options: { device: d.id, channel: c.id, mode: 'press' } },
						],
						up: [
							{ actionId: 'talk_channel', options: { device: d.id, channel: c.id, mode: 'release' } },
						],
					},
				],
				feedbacks: [
					{
						feedbackId: 'device_talking',
						options: { device: d.id, channel: c.id },
						style: { bgcolor: 'green', color: 'black' },
					},
				],
			}
		}
	}

	return { presets, omitted }
}

/** Der Kern liefert Geraete/Kanaele als Objekt; Tests und aeltere Staende als Liste. */
function toList(v) {
	if (Array.isArray(v)) return v.filter(Boolean)
	if (v && typeof v === 'object') return Object.values(v).filter(Boolean)
	return []
}

/**
 * Die Kanaele, die eine Sprechstelle fuehrt.
 *
 * Der Kern nennt sie `channelIds` (Zuweisung aus dem Plan). Faellt das Feld
 * weg, gibt es KEINE Kanal-Taste fuer diese Sprechstelle — statt sie auf
 * allen Kanaelen zu vermuten. Eine geratene Sprechtaste schaltet im Betrieb
 * das falsche Mikrofon auf den falschen Kanal.
 */
function channelIds(device) {
	const raw = device?.channelIds ?? device?.channels
	if (Array.isArray(raw)) return raw.map((c) => (typeof c === 'string' ? c : c?.id)).filter(Boolean)
	return []
}
