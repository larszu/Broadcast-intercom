import WebSocket from 'ws'
import { InstanceStatus } from '@companion-module/base'

/**
 * IntercomConnection keeps a live copy of the intercom core `CoreState`.
 *
 * It maintains a WebSocket to `/ws` for instant state pushes and, as a safety
 * net, polls `GET /api/state` on an interval in case the socket drops. Control
 * commands are issued over REST (`POST /api/control/action`) while richer
 * messages that only exist on the WebSocket protocol (direct calls, talk on a
 * named channel) are sent straight down the socket.
 */
export class IntercomConnection {
	constructor(instance) {
		this.instance = instance
		this.state = null
		this.ws = null
		this.pollTimer = null
		this.reconnectTimer = null
		this.destroyed = false
		this.connected = false
	}

	get baseUrl() {
		const host = (this.instance.config.host || '127.0.0.1').trim()
		const port = Number(this.instance.config.port || 4001)
		return `http://${host}:${port}`
	}

	get wsUrl() {
		return this.baseUrl.replace(/^http/, 'ws') + '/ws'
	}

	start() {
		this.destroyed = false
		this.openSocket()
		this.startPolling()
	}

	stop() {
		this.destroyed = true
		this.connected = false
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.reconnectTimer = null
		this.pollTimer = null
		if (this.ws) {
			try {
				this.ws.removeAllListeners()
				this.ws.close()
			} catch (_e) {
				// ignore
			}
			this.ws = null
		}
	}

	openSocket() {
		if (this.destroyed) return
		try {
			this.ws = new WebSocket(this.wsUrl)
		} catch (e) {
			this.instance.log('error', `WebSocket create failed: ${e.message}`)
			this.scheduleReconnect()
			return
		}

		this.ws.on('open', () => {
			this.setConnected(true)
			this.instance.log('debug', `WebSocket connected to ${this.wsUrl}`)
		})

		this.ws.on('message', (raw) => {
			let msg
			try {
				msg = JSON.parse(raw.toString())
			} catch (_e) {
				return
			}
			if (msg?.type === 'state' && msg.payload) {
				this.applyState(msg.payload)
			}
		})

		this.ws.on('close', () => {
			this.setConnected(false)
			this.scheduleReconnect()
		})

		this.ws.on('error', (e) => {
			this.instance.log('debug', `WebSocket error: ${e.message}`)
			// 'close' will follow and schedule the reconnect.
		})
	}

	scheduleReconnect() {
		if (this.destroyed || this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			if (this.ws) {
				try {
					this.ws.removeAllListeners()
					this.ws.close()
				} catch (_e) {
					// ignore
				}
				this.ws = null
			}
			this.openSocket()
		}, 3000)
	}

	startPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		const interval = Math.max(500, Number(this.instance.config.pollInterval || 2000))
		this.pollTimer = setInterval(() => this.poll(), interval)
		// Kick off an immediate poll so state is populated even before the socket opens.
		this.poll()
	}

	async poll() {
		if (this.destroyed) return
		try {
			const res = await fetch(`${this.baseUrl}/api/state`, { signal: AbortSignal.timeout(4000) })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const state = await res.json()
			this.applyState(state)
			// A successful REST poll also counts as "reachable" even if the socket is mid-reconnect.
			if (!this.connected) this.setConnected(true)
		} catch (e) {
			this.setConnected(false)
			this.instance.log('debug', `State poll failed: ${e.message}`)
		}
	}

	applyState(state) {
		this.state = state
		this.instance.onStateUpdate(state)
	}

	setConnected(connected) {
		if (this.connected === connected) return
		this.connected = connected
		this.instance.updateStatus(
			connected ? InstanceStatus.Ok : InstanceStatus.Disconnected,
			connected ? undefined : 'No connection to intercom core',
		)
		this.instance.onConnectionChange(connected)
	}

	/** POST /api/control/action — the Companion-compatible control endpoint. */
	async control(action, deviceId, slotIndex) {
		const body = { action }
		if (deviceId) body.deviceId = deviceId
		if (typeof slotIndex === 'number') body.slotIndex = slotIndex
		try {
			const res = await fetch(`${this.baseUrl}/api/control/action`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(4000),
			})
			if (!res.ok) {
				const text = await res.text().catch(() => '')
				this.instance.log('warn', `Control "${action}" failed: HTTP ${res.status} ${text}`)
				return false
			}
			return true
		} catch (e) {
			this.instance.log('error', `Control "${action}" error: ${e.message}`)
			return false
		}
	}

	/** Send a raw message on the WebSocket protocol (direct calls, talk-on-channel). */
	sendWs(message) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message))
			return true
		}
		this.instance.log('warn', `Cannot send ${message?.type}: WebSocket not open`)
		return false
	}

	// ── Convenience accessors over the current state ────────────────────────────

	devices() {
		return this.state ? Object.values(this.state.devices || {}) : []
	}

	users() {
		return this.state ? Object.values(this.state.users || {}) : []
	}

	channels() {
		return this.state ? Object.values(this.state.channels || {}) : []
	}

	temporaryChannels() {
		return this.state ? this.state.temporaryChannels || [] : []
	}

	device(id) {
		return this.state?.devices?.[id]
	}

	/** Current emergency state, derived from the most recent emergency system event. */
	emergencyActive() {
		const events = this.state?.events || []
		const evt = events.find((e) => e.type === 'system' && /Emergency/i.test(e.message))
		if (!evt) return false
		// Order matters: "deactivated" also contains the substring "activated".
		if (/deactivated/i.test(evt.message)) return false
		return /activated/i.test(evt.message)
	}
}
