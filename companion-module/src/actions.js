import { deviceChoices, userChoices, channelChoices, tempChannelChoices } from './choices.js'

const SLOT_OPTION = {
	type: 'number',
	id: 'slot',
	label: 'Slot index (0-based)',
	default: 0,
	min: 0,
	max: 7,
	tooltip: 'Which of the device’s assigned channels to talk on (0 = first).',
}

function deviceOption(conn) {
	return {
		type: 'dropdown',
		id: 'device',
		label: 'Beltpack / device',
		default: conn.devices()[0]?.id ?? '',
		choices: deviceChoices(conn),
		allowCustom: true,
	}
}

export function getActions(instance) {
	const conn = instance.connection

	return {
		ptt: {
			name: 'Push-to-talk (PTT)',
			options: [
				deviceOption(conn),
				SLOT_OPTION,
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: 'press',
					choices: [
						{ id: 'press', label: 'Talk (start)' },
						{ id: 'release', label: 'Release (stop)' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (event) => {
				const device = String(event.options.device)
				const slot = Number(event.options.slot)
				let mode = event.options.mode
				if (mode === 'toggle') {
					mode = conn.device(device)?.talkChannelId ? 'release' : 'press'
				}
				await conn.control(mode === 'press' ? 'ptt_start' : 'ptt_stop', device, slot)
				instance.checkFeedbacks('device_talking')
			},
		},

		talk_channel: {
			name: 'Talk on named channel',
			options: [
				deviceOption(conn),
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Channel',
					default: conn.channels()[0]?.id ?? '',
					choices: channelChoices(conn),
					allowCustom: true,
				},
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: 'press',
					choices: [
						{ id: 'press', label: 'Talk (start)' },
						{ id: 'release', label: 'Release (stop)' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (event) => {
				const device = String(event.options.device)
				const channelId = String(event.options.channel)
				let mode = event.options.mode
				if (mode === 'toggle') {
					mode = conn.device(device)?.talkChannelId === channelId ? 'release' : 'press'
				}
				conn.sendWs({ type: 'set_talk', payload: { id: device, channelId, active: mode === 'press' } })
				instance.checkFeedbacks('device_talking')
			},
		},

		mute: {
			name: 'Mute / unmute audio',
			options: [
				deviceOption(conn),
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
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: 'mute',
					choices: [
						{ id: 'mute', label: 'Mute' },
						{ id: 'unmute', label: 'Unmute (0 dB)' },
					],
				},
			],
			callback: async (event) => {
				const device = String(event.options.device)
				const field = event.options.direction === 'output' ? 'outputGainDb' : 'inputGainDb'
				if (event.options.mode === 'mute') {
					await conn.control(event.options.direction === 'output' ? 'mute_output' : 'mute_input', device)
				} else {
					// The control endpoint has no "unmute", so restore the gain directly.
					try {
						await fetch(`${conn.baseUrl}/api/devices/${encodeURIComponent(device)}/audio`, {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ [field]: 0 }),
						})
					} catch (e) {
						instance.log('error', `Unmute failed: ${e.message}`)
					}
				}
				instance.checkFeedbacks('device_muted')
			},
		},

		volume: {
			name: 'Volume up / down',
			options: [
				deviceOption(conn),
				{
					type: 'dropdown',
					id: 'direction',
					label: 'Direction',
					default: 'up',
					choices: [
						{ id: 'up', label: 'Up (+3 dB)' },
						{ id: 'down', label: 'Down (-3 dB)' },
					],
				},
			],
			callback: async (event) => {
				await conn.control(event.options.direction === 'up' ? 'volume_up' : 'volume_down', String(event.options.device))
			},
		},

		emergency: {
			name: 'Emergency',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Mode',
					default: 'toggle',
					choices: [
						{ id: 'start', label: 'Activate' },
						{ id: 'stop', label: 'Deactivate' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (event) => {
				let mode = event.options.mode
				if (mode === 'toggle') mode = conn.emergencyActive() ? 'stop' : 'start'
				await conn.control(mode === 'start' ? 'emergency_start' : 'emergency_stop')
				instance.checkFeedbacks('emergency_active')
			},
		},

		direct_call_start: {
			name: 'Direct call — start',
			options: [
				{
					type: 'dropdown',
					id: 'device',
					label: 'From device',
					default: conn.devices()[0]?.id ?? '',
					choices: deviceChoices(conn),
					allowCustom: true,
				},
				{
					type: 'dropdown',
					id: 'toUser',
					label: 'To user',
					default: conn.users()[0]?.id ?? '',
					choices: userChoices(conn),
					allowCustom: true,
				},
			],
			callback: async (event) => {
				conn.sendWs({
					type: 'direct_call',
					payload: { fromDeviceId: String(event.options.device), toUserId: String(event.options.toUser) },
				})
			},
		},

		direct_call_end: {
			name: 'Direct call — end',
			options: [
				{
					type: 'dropdown',
					id: 'tempChannel',
					label: 'Active direct call',
					default: '',
					choices: tempChannelChoices(conn),
					allowCustom: true,
				},
			],
			callback: async (event) => {
				conn.sendWs({ type: 'direct_call_end', payload: { tempChannelId: String(event.options.tempChannel) } })
			},
		},

		load_config: {
			name: 'Load show configuration',
			options: [
				{
					type: 'textinput',
					id: 'name',
					label: 'Config name',
					default: '',
				},
			],
			callback: async (event) => {
				try {
					await fetch(`${conn.baseUrl}/api/configs/load`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name: String(event.options.name) }),
					})
				} catch (e) {
					instance.log('error', `Load config failed: ${e.message}`)
				}
			},
		},
	}
}
