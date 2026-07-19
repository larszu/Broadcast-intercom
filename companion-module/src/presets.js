import { combineRgb } from '@companion-module/base'

const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const DARK = combineRgb(20, 20, 20)
const GREEN = combineRgb(0, 170, 80)
const RED = combineRgb(200, 30, 30)

/**
 * Preset templates. Device/channel option ids are left at their defaults so the
 * operator only has to pick the target beltpack on the button — the live
 * dropdowns in the action/feedback editors are populated from the core state.
 */
export function getPresets() {
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

	return presets
}
