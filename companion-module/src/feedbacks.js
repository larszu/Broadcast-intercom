import { combineRgb } from '@companion-module/base'
import { deviceChoices, channelChoices } from './choices.js'

const RED = combineRgb(200, 30, 30)
const GREEN = combineRgb(0, 170, 80)
const AMBER = combineRgb(230, 150, 20)
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

export function getFeedbacks(instance) {
	const conn = instance.connection

	function deviceOption() {
		return {
			type: 'dropdown',
			id: 'device',
			label: 'Beltpack / device',
			default: conn.devices()[0]?.id ?? '',
			choices: deviceChoices(conn),
			allowCustom: true,
		}
	}

	return {
		device_talking: {
			type: 'boolean',
			name: 'Device is talking',
			description: 'Active when the device has an open talk channel (optionally a specific one).',
			defaultStyle: { bgcolor: GREEN, color: BLACK },
			options: [
				deviceOption(),
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Channel (optional)',
					default: 'any',
					choices: [{ id: 'any', label: 'Any channel' }, ...channelChoices(conn)],
					allowCustom: true,
				},
			],
			callback: (feedback) => {
				const device = conn.device(String(feedback.options.device))
				if (!device?.talkChannelId) return false
				const channel = String(feedback.options.channel)
				return channel === 'any' ? true : device.talkChannelId === channel
			},
		},

		device_muted: {
			type: 'boolean',
			name: 'Device is muted',
			description: 'Active when the selected input or output gain is muted (≤ -60 dB).',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				deviceOption(),
				{
					type: 'dropdown',
					id: 'direction',
					label: 'Direction',
					default: 'input',
					choices: [
						{ id: 'input', label: 'Input (microphone)' },
						{ id: 'output', label: 'Output (headphones)' },
					],
				},
			],
			callback: (feedback) => {
				const device = conn.device(String(feedback.options.device))
				if (!device?.audio) return false
				const gain = feedback.options.direction === 'output' ? device.audio.outputGainDb : device.audio.inputGainDb
				return gain <= -60
			},
		},

		device_offline: {
			type: 'boolean',
			name: 'Device is offline',
			description: 'Active when the device network link reports offline.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [deviceOption()],
			callback: (feedback) => {
				const device = conn.device(String(feedback.options.device))
				return device ? device.network?.online === false : false
			},
		},

		battery_low: {
			type: 'boolean',
			name: 'Battery low',
			description: 'Active when a wireless device battery drops below the threshold.',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [
				deviceOption(),
				{
					type: 'number',
					id: 'threshold',
					label: 'Threshold (%)',
					default: 20,
					min: 1,
					max: 100,
				},
			],
			callback: (feedback) => {
				const device = conn.device(String(feedback.options.device))
				if (!device?.battery || device.battery.charging) return false
				return device.battery.percent <= Number(feedback.options.threshold)
			},
		},

		emergency_active: {
			type: 'boolean',
			name: 'Emergency active',
			description: 'Active while the emergency channel has been activated.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => conn.emergencyActive(),
		},

		connection_ok: {
			type: 'boolean',
			name: 'Connected to core',
			description: 'Active while the module has a live connection to the intercom core.',
			defaultStyle: { bgcolor: GREEN, color: BLACK },
			options: [],
			callback: () => conn.connected,
		},
	}
}
