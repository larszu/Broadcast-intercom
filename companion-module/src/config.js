import { Regex } from '@companion-module/base'

export const configFields = [
	{
		type: 'static-text',
		id: 'info',
		width: 12,
		label: 'Broadcast Intercom',
		value:
			'Controls a Broadcast Intercom core server. Enter the host and port of the core ' +
			'(the same machine that serves the operator UI). The module keeps a live WebSocket ' +
			'connection for instant talk / battery / emergency feedback.',
	},
	{
		type: 'textinput',
		id: 'host',
		label: 'Core Host / IP',
		width: 8,
		default: '127.0.0.1',
		regex: Regex.HOSTNAME,
	},
	{
		type: 'number',
		id: 'port',
		label: 'Core Port',
		width: 4,
		default: 4001,
		min: 1,
		max: 65535,
	},
	{
		type: 'number',
		id: 'pollInterval',
		label: 'State poll fallback (ms)',
		width: 6,
		default: 2000,
		min: 500,
		max: 60000,
		tooltip: 'Backup REST polling interval used when the live WebSocket is unavailable.',
	},
]
