import { combineRgb } from '@companion-module/base'
import { COLOURS, derivePresets } from './presetPlan.js'

const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const DARK = combineRgb(20, 20, 20)
const GREEN = combineRgb(0, 170, 80)
const RED = combineRgb(200, 30, 30)

/** Farbname aus `presetPlan.js` → Companion-Zahl. Die Ableitung kennt keine
 *  Companion-Typen, damit sie ohne die Modul-Abhaengigkeit pruefbar bleibt. */
const rgb = (name) => {
	const c = COLOURS[name]
	return c ? combineRgb(c[0], c[1], c[2]) : combineRgb(0, 0, 0)
}

/** Ein abgeleitetes Preset in Companion-Farben uebersetzen. */
const withColours = (p) => ({
	...p,
	style: { ...p.style, color: rgb(p.style.color), bgcolor: rgb(p.style.bgcolor) },
	feedbacks: (p.feedbacks ?? []).map((f) => ({
		...f,
		style: { ...f.style, bgcolor: rgb(f.style.bgcolor), color: rgb(f.style.color) },
	})),
})

/**
 * Preset templates. Device/channel option ids are left at their defaults so the
 * operator only has to pick the target beltpack on the button — the live
 * dropdowns in the action/feedback editors are populated from the core state.
 *
 * BEDARF 3: dazu kommen die aus dem KERN-ZUSTAND abgeleiteten Tasten (fertig
 * ausgefuellt, eine je Sprechstelle und je gefuehrtem Kanal). Die Vorlagen
 * bleiben daneben: ohne erreichbaren Kern muss man weiter von Hand bauen
 * koennen, und eine leere Liste waere fuer genau den Fall eine
 * Verschlechterung. `instance` ist optional, damit ein Aufruf ohne Verbindung
 * (Erststart) genau die Vorlagen liefert wie vorher.
 */
export function getPresets(instance) {
	const presets = {}

	presets.ptt_hold = {
		type: 'button',
		category: 'Push-to-talk',
		name: 'PTT (hold to talk)',
		style: { text: 'PTT\\n$(broadcast-intercom:device_count) dev', size: '18', color: WHITE, bgcolor: DARK },
		steps: [
			{
				down: [{ actionId: 'ptt', options: { device: '', slot: 0, mode: 'press' } }],
				up: [{ actionId: 'ptt', options: { device: '', slot: 0, mode: 'release' } }],
			},
		],
		feedbacks: [
			{
				feedbackId: 'device_talking',
				options: { device: '', channel: 'any' },
				style: { bgcolor: GREEN, color: BLACK },
			},
		],
	}

	presets.ptt_toggle = {
		type: 'button',
		category: 'Push-to-talk',
		name: 'PTT (toggle / latch)',
		style: { text: 'TALK', size: '18', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'ptt', options: { device: '', slot: 0, mode: 'toggle' } }], up: [] }],
		feedbacks: [
			{
				feedbackId: 'device_talking',
				options: { device: '', channel: 'any' },
				style: { bgcolor: GREEN, color: BLACK },
			},
		],
	}

	presets.mute_input = {
		type: 'button',
		category: 'Audio',
		name: 'Mute microphone',
		style: { text: 'MIC\\nMUTE', size: '18', color: WHITE, bgcolor: DARK },
		steps: [
			{ down: [{ actionId: 'mute', options: { device: '', direction: 'input', mode: 'mute' } }], up: [] },
			{ down: [{ actionId: 'mute', options: { device: '', direction: 'input', mode: 'unmute' } }], up: [] },
		],
		feedbacks: [
			{
				feedbackId: 'device_muted',
				options: { device: '', direction: 'input' },
				style: { bgcolor: RED, color: WHITE },
			},
		],
	}

	presets.volume_up = {
		type: 'button',
		category: 'Audio',
		name: 'Volume up',
		style: { text: 'VOL\\n▲', size: '18', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'volume', options: { device: '', direction: 'up' } }], up: [] }],
		feedbacks: [],
	}

	presets.volume_down = {
		type: 'button',
		category: 'Audio',
		name: 'Volume down',
		style: { text: 'VOL\\n▼', size: '18', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'volume', options: { device: '', direction: 'down' } }], up: [] }],
		feedbacks: [],
	}

	presets.emergency = {
		type: 'button',
		category: 'System',
		name: 'Emergency toggle',
		style: { text: 'EMER\\nGENCY', size: '14', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'emergency', options: { mode: 'toggle' } }], up: [] }],
		feedbacks: [{ feedbackId: 'emergency_active', options: {}, style: { bgcolor: RED, color: WHITE } }],
	}

	presets.connection = {
		type: 'button',
		category: 'System',
		name: 'Core connection status',
		style: { text: 'CORE\\n$(broadcast-intercom:connection)', size: '14', color: WHITE, bgcolor: RED },
		steps: [],
		feedbacks: [{ feedbackId: 'connection_ok', options: {}, style: { bgcolor: GREEN, color: BLACK } }],
	}

	// ── Aus dem Plan abgeleitet (Bedarf 3) ────────────────────────────────────
	const state = instance?.connection?.state
	if (state) {
		const { presets: derived, omitted } = derivePresets(state)
		for (const [key, p] of Object.entries(derived)) presets[key] = withColours(p)
		// Kein stilles Abschneiden: wer mehr Sprechstellen hat, als Tasten
		// entstehen, erfaehrt es im Log statt es auf der Oberflaeche zu suchen.
		const weggelassen = omitted.devices + omitted.channels
		if (weggelassen > 0 && typeof instance.log === 'function') {
			instance.log(
				'warn',
				`Preset-Liste gekuerzt: ${omitted.devices} Sprechstelle(n) und ${omitted.channels} Kanal-Taste(n) nicht aufgenommen.`,
			)
		}
	}

	return presets
}
