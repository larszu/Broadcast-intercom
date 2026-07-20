/** Companion variable ids may only contain letters, numbers and underscores. */
function safeId(id) {
	return String(id).replace(/[^a-zA-Z0-9]+/g, '_')
}

export function getVariableDefinitions(instance) {
	const conn = instance.connection
	const defs = [
		{ variableId: 'connection', name: 'Connection state (connected/disconnected)' },
		{ variableId: 'active_config', name: 'Active show configuration name' },
		{ variableId: 'device_count', name: 'Number of devices' },
		{ variableId: 'user_count', name: 'Number of users' },
		{ variableId: 'channel_count', name: 'Number of channels' },
		{ variableId: 'talking_count', name: 'Number of devices currently talking' },
		{ variableId: 'emergency', name: 'Emergency active (yes/no)' },
		{ variableId: 'direct_call_count', name: 'Active direct calls' },
	]

	for (const d of conn.devices()) {
		const s = safeId(d.id)
		defs.push({ variableId: `device_${s}_label`, name: `Device ${d.id} — label` })
		defs.push({ variableId: `device_${s}_talking`, name: `Device ${d.id} — talking (yes/no)` })
		defs.push({ variableId: `device_${s}_talk_channel`, name: `Device ${d.id} — talk channel` })
		defs.push({ variableId: `device_${s}_battery`, name: `Device ${d.id} — battery %` })
		defs.push({ variableId: `device_${s}_online`, name: `Device ${d.id} — online (yes/no)` })
	}

	return defs
}

export function getVariableValues(instance) {
	const conn = instance.connection
	const state = conn.state
	const values = {
		connection: conn.connected ? 'connected' : 'disconnected',
		active_config: state?.activeConfig?.name ?? '-',
		device_count: conn.devices().length,
		user_count: conn.users().length,
		channel_count: conn.channels().length,
		talking_count: conn.devices().filter((d) => d.talkChannelId).length,
		emergency: conn.emergencyActive() ? 'yes' : 'no',
		direct_call_count: conn.temporaryChannels().length,
	}

	for (const d of conn.devices()) {
		const s = safeId(d.id)
		values[`device_${s}_label`] = d.label
		values[`device_${s}_talking`] = d.talkChannelId ? 'yes' : 'no'
		values[`device_${s}_talk_channel`] = d.talkChannelId
			? state?.channels?.[d.talkChannelId]?.name ?? d.talkChannelId
			: '-'
		values[`device_${s}_battery`] = d.battery?.percent ?? '-'
		values[`device_${s}_online`] = d.network?.online === false ? 'no' : 'yes'
	}

	return values
}
