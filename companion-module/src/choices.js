/**
 * Helpers that turn the live intercom state into Companion dropdown choices.
 * All dropdowns fall back to a friendly placeholder when the state has not
 * loaded yet, and device/user/channel pickers allow a custom typed value so
 * buttons can be pre-configured before the core is reachable.
 */

function withPlaceholder(choices, emptyLabel) {
	if (choices.length > 0) return choices
	return [{ id: '', label: emptyLabel }]
}

export function deviceChoices(conn) {
	return withPlaceholder(
		conn.devices().map((d) => ({ id: d.id, label: `${d.label} (${d.id})` })),
		'(no devices — check connection)',
	)
}

export function userChoices(conn) {
	return withPlaceholder(
		conn.users().map((u) => ({ id: u.id, label: `${u.name} (${u.role})` })),
		'(no users — check connection)',
	)
}

export function channelChoices(conn) {
	return withPlaceholder(
		conn.channels().map((c) => ({ id: c.id, label: `${c.name} (${c.id})` })),
		'(no channels — check connection)',
	)
}

export function tempChannelChoices(conn) {
	return withPlaceholder(
		conn.temporaryChannels().map((t) => ({
			id: t.id,
			label: `${t.callerUserId} → ${t.receiverUserId}`,
		})),
		'(no active direct calls)',
	)
}
