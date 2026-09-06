import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { IntercomConnection } from './api.js'
import { configFields } from './config.js'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getPresets } from './presets.js'
import { getVariableDefinitions, getVariableValues } from './variables.js'
import { upgradeScripts } from './upgrades.js'

class BroadcastIntercomInstance extends InstanceBase {
	async init(config) {
		this.config = config
		this.connection = new IntercomConnection(this)
		this._devicesSignature = ''

		this.updateStatus(InstanceStatus.Connecting)

		this.setActionDefinitions(getActions(this))
		this.setFeedbackDefinitions(getFeedbacks(this))
		this.setPresetDefinitions(getPresets(this))
		this.setVariableDefinitions(getVariableDefinitions(this))

		this.connection.start()
	}

	async destroy() {
		if (this.connection) this.connection.stop()
	}

	async configUpdated(config) {
		this.config = config
		if (this.connection) this.connection.stop()
		this.connection = new IntercomConnection(this)
		this._devicesSignature = ''
		this.connection.start()
	}

	getConfigFields() {
		return configFields
	}

	/** Called by IntercomConnection whenever a fresh CoreState arrives. */
	onStateUpdate(state) {
		// Rebuild dropdowns + variable definitions only when the device/user/channel
		// set actually changes — cheap on every tick, correct when topology changes.
		const signature = [
			Object.keys(state.devices || {}).join(','),
			Object.keys(state.users || {}).join(','),
			Object.keys(state.channels || {}).join(','),
			(state.temporaryChannels || []).map((t) => t.id).join(','),
		].join('|')

		if (signature !== this._devicesSignature) {
			this._devicesSignature = signature
			this.setActionDefinitions(getActions(this))
			this.setFeedbackDefinitions(getFeedbacks(this))
			this.setVariableDefinitions(getVariableDefinitions(this))
			// Bedarf 3: die Tasten gehoeren dazu. Bis hierher standen sie NICHT
			// in dieser Liste — sie wurden einmal in `init()` gesetzt, vor der
			// ersten Verbindung, und konnten deshalb nie etwas ueber den
			// geladenen Plan wissen. Aktionen, Feedbacks und Variablen wurden
			// hier seit jeher nachgezogen; die Tasten waren die Ausnahme, und
			// niemandem ist es aufgefallen, weil eine Vorlage mit `device: ''`
			// auch ohne Plan „richtig" aussieht.
			this.setPresetDefinitions(getPresets(this))
		}

		this.setVariableValues(getVariableValues(this))
		this.checkFeedbacks()
	}

	onConnectionChange(_connected) {
		this.setVariableValues(getVariableValues(this))
		this.checkFeedbacks('connection_ok')
	}
}

runEntrypoint(BroadcastIntercomInstance, upgradeScripts)
