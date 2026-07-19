// Integration harness: drive the real module logic against a live intercom core.
// Mocks the Companion InstanceBase surface the module actually uses.
import { IntercomConnection } from '../src/api.js'
import { getActions } from '../src/actions.js'
import { getFeedbacks } from '../src/feedbacks.js'
import { getPresets } from '../src/presets.js'
import { getVariableDefinitions, getVariableValues } from '../src/variables.js'

const HOST = process.env.CORE_HOST || '127.0.0.1'
const PORT = Number(process.env.CORE_PORT || 4001)

let pass = 0,
	fail = 0
const lines = []
function check(name, cond, detail = '') {
	if (cond) {
		pass++
		lines.push(`  PASS  ${name}`)
	} else {
		fail++
		lines.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

// Minimal fake instance implementing the InstanceBase methods the module calls.
class FakeInstance {
	constructor() {
		this.config = { host: HOST, port: PORT, pollInterval: 1000 }
		this.variables = {}
		this.feedbackChecks = 0
		this.logs = []
	}
	log(level, msg) {
		this.logs.push(`${level}: ${msg}`)
	}
	updateStatus(status, msg) {
		this.status = status
		this.statusMsg = msg
	}
	setVariableValues(v) {
		Object.assign(this.variables, v)
	}
	checkFeedbacks() {
		this.feedbackChecks++
	}
	onStateUpdate() {}
	onConnectionChange() {}
}

function waitFor(fn, timeoutMs = 6000, interval = 100) {
	return new Promise((resolve, reject) => {
		const start = Date.now()
		const t = setInterval(() => {
			let ok = false
			try {
				ok = fn()
			} catch {
				ok = false
			}
			if (ok) {
				clearInterval(t)
				resolve(true)
			} else if (Date.now() - start > timeoutMs) {
				clearInterval(t)
				reject(new Error('timeout waiting for condition'))
			}
		}, interval)
	})
}

async function api(method, path, body) {
	const res = await fetch(`http://${HOST}:${PORT}${path}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	})
	return { status: res.status, json: await res.json().catch(() => null) }
}

async function main() {
	// Seed a device we can drive.
	await api('POST', '/api/devices', {
		id: 'bp-comp-1',
		label: 'Companion Test BP',
		transport: 'ethernet',
		channelIds: ['ch1', 'ch2'],
	})

	const inst = new FakeInstance()
	inst.connection = new IntercomConnection(inst)
	inst.connection.start()

	// 1. Connection establishes and state loads.
	await waitFor(() => inst.connection.state && inst.connection.device('bp-comp-1'))
	check('connection loads live state', Boolean(inst.connection.state))
	check('connection reports connected', inst.connection.connected === true)

	// 2. Definition generators produce valid structures.
	const actions = getActions(inst)
	check('actions defined', Object.keys(actions).length >= 8, `got ${Object.keys(actions).length}`)
	check('ptt action has callback', typeof actions.ptt?.callback === 'function')
	const deviceOpt = actions.ptt.options.find((o) => o.id === 'device')
	check('ptt device dropdown populated from state', deviceOpt.choices.some((c) => c.id === 'bp-comp-1'))

	const feedbacks = getFeedbacks(inst)
	check('feedbacks defined', Object.keys(feedbacks).length >= 5, `got ${Object.keys(feedbacks).length}`)
	check('device_talking is boolean feedback', feedbacks.device_talking?.type === 'boolean')

	const presets = getPresets()
	check('presets defined', Object.keys(presets).length >= 6, `got ${Object.keys(presets).length}`)

	const varDefs = getVariableDefinitions(inst)
	check('variable definitions include per-device', varDefs.some((v) => v.variableId === 'device_bp_comp_1_talking'))

	// 3. PTT start via the real action callback → server reflects talk state.
	await actions.ptt.callback({ options: { device: 'bp-comp-1', slot: 0, mode: 'press' } })
	await waitFor(() => Boolean(inst.connection.device('bp-comp-1')?.talkChannelId))
	check('ptt press sets talkChannelId on core', Boolean(inst.connection.device('bp-comp-1')?.talkChannelId))
	check('device_talking feedback true while talking', feedbacks.device_talking.callback({ options: { device: 'bp-comp-1', channel: 'any' } }) === true)

	const vals1 = getVariableValues(inst)
	check('talking_count variable reflects talk', vals1.talking_count >= 1, `got ${vals1.talking_count}`)
	check('device talk variable = yes', vals1.device_bp_comp_1_talking === 'yes')

	// 4. PTT release.
	await actions.ptt.callback({ options: { device: 'bp-comp-1', slot: 0, mode: 'release' } })
	await waitFor(() => !inst.connection.device('bp-comp-1')?.talkChannelId)
	check('ptt release clears talkChannelId', !inst.connection.device('bp-comp-1')?.talkChannelId)
	check('device_talking feedback false after release', feedbacks.device_talking.callback({ options: { device: 'bp-comp-1', channel: 'any' } }) === false)

	// 5. Mute + feedback.
	await actions.mute.callback({ options: { device: 'bp-comp-1', direction: 'input', mode: 'mute' } })
	await waitFor(() => inst.connection.device('bp-comp-1')?.audio?.inputGainDb <= -60)
	check('mute input reflected in state', inst.connection.device('bp-comp-1').audio.inputGainDb <= -60)
	check('device_muted feedback true', feedbacks.device_muted.callback({ options: { device: 'bp-comp-1', direction: 'input' } }) === true)

	// 6. Unmute restores gain.
	await actions.mute.callback({ options: { device: 'bp-comp-1', direction: 'input', mode: 'unmute' } })
	await waitFor(() => inst.connection.device('bp-comp-1')?.audio?.inputGainDb === 0)
	check('unmute restores gain to 0', inst.connection.device('bp-comp-1').audio.inputGainDb === 0)

	// 7. Emergency toggle + feedback.
	await actions.emergency.callback({ options: { mode: 'start' } })
	await waitFor(() => inst.connection.emergencyActive() === true)
	check('emergency_active feedback true after start', feedbacks.emergency_active.callback() === true)
	await actions.emergency.callback({ options: { mode: 'stop' } })
	await waitFor(() => inst.connection.emergencyActive() === false)
	check('emergency_active feedback false after stop', feedbacks.emergency_active.callback() === false)

	// 8. connection_ok feedback.
	check('connection_ok feedback true', feedbacks.connection_ok.callback() === true)

	// Cleanup.
	await api('DELETE', '/api/devices/bp-comp-1')
	inst.connection.stop()

	console.log(lines.join('\n'))
	console.log(`\n──────────────────────────────\nRESULT: ${pass} passed, ${fail} failed`)
	process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
	console.log(lines.join('\n'))
	console.error('Harness error:', e.message)
	process.exit(2)
})
