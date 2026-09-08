#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Der Plan-Vertrag kennt die Bedeutung der Felder, nicht nur ihre Namen.
//
// BEFUND (Defektformen-Sweep, Form `vertrag-nur-feldnamen`, gemessen
// 2026-09-07). `parseIntercomPlan` prueft `typeof o.version !== "number"` —
// den NAMEN und den TYP des Feldes — und verglich die Zahl danach mit nichts.
// Ein Plan mit `version: 7`, geschrieben von einem Exporteur, den es heute
// noch nicht gibt, wurde mit v1-Bedeutung gelesen. Alle Schwester-Formate
// dieser Familie lehnen eine zu neue Version ab (`camera-list`, `.avplan`,
// `venue-exchange`, `avplan-inventory`); dieses eine nicht. Und was hier
// falsch verstanden wird, sind SPRECHBERECHTIGUNGEN an einer Anlage, an der
// gleich jemand arbeitet.
//
// Der zweite Teil desselben Befundes: unlesbare Eintraege fielen per
// `continue` STILL aus der Liste. Eine Datei, deren Sprechstellen alle eine
// unlesbare Id haben, ergab eine leere Liste, der Abgleich sagte „nichts zu
// tun", und niemand erfuhr, dass die Haelfte der Datei weggeworfen wurde.
// Der Abgleich ist genau dafuer da, VORHER zu zeigen, was passiert (B-41.2).
//
// Der Lauf importiert `packages/shared/src/index.ts` direkt — Node 22 zieht
// die Typen beim Laden ab, es braucht also keinen Build.
//
// Lauf: `npm run plan:check`
// ───────────────────────────────────────────────────────────────────────────
import {
	INTERCOM_PLAN_FORMAT,
	INTERCOM_PLAN_VERSION,
	readIntercomPlan,
	parseIntercomPlan,
	diffIntercomPlan,
} from '../packages/shared/src/index.ts'

let pass = 0
let fail = 0
const check = (name, cond, detail = '') => {
	if (cond) {
		pass++
		console.log(`  PASS  ${name}`)
	} else {
		fail++
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

/** Ein Plan, wie der Cable-Planner ihn schreibt. */
const guterPlan = () => ({
	format: INTERCOM_PLAN_FORMAT,
	version: INTERCOM_PLAN_VERSION,
	exportedAt: '2026-09-07T00:00:00.000Z',
	systemName: 'Show A',
	channels: [{ id: 'c1', name: 'PGM' }, { id: 'c2', name: 'Ton' }],
	stations: [
		{ id: 's1', name: 'Regie', memberships: [{ channelId: 'c1', talk: true, listen: true }] },
		{ id: 's2', name: 'Kamera 1', memberships: [{ channelId: 'c1', talk: false, listen: true }] },
	],
})
const lies = (o) => readIntercomPlan(JSON.stringify(o))

console.log('Die Version wird nicht nur gezaehlt, sondern verstanden')

const gut = lies(guterPlan())
check('der gute Plan wird angenommen', gut.ok, gut.ok ? '' : gut.error)
check('… mit beiden Kanaelen und beiden Sprechstellen',
	gut.ok && gut.file.channels.length === 2 && gut.file.stations.length === 2)

const zuNeu = lies({ ...guterPlan(), version: INTERCOM_PLAN_VERSION + 1 })
check('eine zu neue Version wird ABGELEHNT', !zuNeu.ok)
check('… und die Meldung nennt beide Versionen',
	!zuNeu.ok && zuNeu.error.includes(String(INTERCOM_PLAN_VERSION + 1)) &&
		zuNeu.error.includes(String(INTERCOM_PLAN_VERSION)),
	!zuNeu.ok ? zuNeu.error : '')
check('eine aeltere Version bleibt lesbar',
	// Gegenprobe: „alles ablehnen, was nicht exakt passt" waere der falsche
	// Fix — alte Plaene sollen weiter eingelesen werden koennen.
	INTERCOM_PLAN_VERSION === 1 || lies({ ...guterPlan(), version: 1 }).ok)
for (const murks of [0, -1, 1.5, '1', null, undefined]) {
	check(`version ${JSON.stringify(murks)} wird abgelehnt`, !lies({ ...guterPlan(), version: murks }).ok)
}

console.log('\nWas nicht gelesen werden kann, wird GENANNT statt verschluckt')

const mitMurks = lies({
	...guterPlan(),
	channels: [{ id: 'c1', name: 'PGM' }, { id: 'c2' }, null, { name: 'ohne Id' }],
	stations: [
		{ id: 's1', name: 'Regie', memberships: [{ channelId: 'c1', talk: true }, {}, 42] },
		{ id: 's2' },
		'kein Objekt',
	],
})
check('die Datei wird trotzdem angenommen', mitMurks.ok)
const sk = mitMurks.ok ? mitMurks.file.skipped : []
check('jeder unlesbare Eintrag steht in `skipped`', sk.length === 7,
	// 3 Kanaele (ohne Name, null, ohne Id), 2 Sprechstellen (ohne Name, kein
	// Objekt), 2 Zugehoerigkeiten (ohne channelId, keine Objekte).
	`gefunden: ${sk.length}`)
check('… mit Angabe, WO er stand',
	sk.every((e) => ['channel', 'station', 'membership'].includes(e.where) && e.index >= 1))
check('… und WARUM', sk.every((e) => typeof e.reason === 'string' && e.reason.length > 0))
check('der lesbare Rest kommt vollstaendig an',
	mitMurks.ok && mitMurks.file.channels.length === 1 && mitMurks.file.stations.length === 1)
check('eine Sprechstelle behaelt ihre lesbaren Zugehoerigkeiten',
	mitMurks.ok && mitMurks.file.stations[0].memberships.length === 1)
check('der Kontext nennt die Sprechstelle bei den Zugehoerigkeiten',
	sk.some((e) => e.where === 'membership' && e.context === 'Regie'),
	JSON.stringify(sk.filter((e) => e.where === 'membership')))

check('ein sauberer Plan hat eine LEERE skipped-Liste',
	// Ohne diese Gegenprobe waere „alles ueberspringen" ebenfalls gruen.
	gut.ok && gut.file.skipped.length === 0)

console.log('\nDer Abgleich zeigt es, BEVOR jemand uebernimmt')

const leererKern = {
	channels: {}, devices: {}, users: {}, groups: {},
}
const diff = diffIntercomPlan(leererKern, mitMurks.file)
check('der Abgleich reicht `skipped` durch', diff.skipped.length === sk.length)
check('… und meldet weiterhin die haltlosen Zugehoerigkeiten',
	Array.isArray(diff.danglingMemberships))

console.log('\nDie bequeme Form ist keine zweite Rechnung')

check('`parseIntercomPlan` liefert dieselbe Datei',
	JSON.stringify(parseIntercomPlan(JSON.stringify(guterPlan()))) === JSON.stringify(gut.file))
check('`parseIntercomPlan` liefert null, wo `readIntercomPlan` ablehnt',
	parseIntercomPlan(JSON.stringify({ ...guterPlan(), version: 99 })) === null)
check('kaputtes JSON wird benannt', !readIntercomPlan('{{').ok)
check('ein fremdes Format wird benannt',
	(() => {
		const r = lies({ ...guterPlan(), format: 'etwas-anderes' })
		return !r.ok && r.error.includes(INTERCOM_PLAN_FORMAT)
	})())

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
