#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die Anbindung an die Geraetebibliothek (devices.zumpelars.de) haelt ihren
// Vertrag.
//
// WARUM ES DAS GIBT (2026-09-25): dieses Repo hat keine Vitest-Tests, die
// Waechter sind die einzige Absicherung. Die Bibliotheksanbindung hat drei
// Stellen, an denen ein Fehler still bleibt und erst bei jemand anderem
// auffaellt:
//
//   1. EINREICHEN UND IMPORT LESEN DASSELBE FORMAT. Das `intercom`-Facet ist
//      der Geraetetyp dieses Planners. Driftet der Schreiber vom Leser weg,
//      reicht man Typen ein, die jeder Intercom-Planner danach als ungueltig
//      verwirft — sichtbar erst beim Abgleich eines anderen.
//   2. KEINE PROJEKTDATEN IN DIE BIBLIOTHEK. Name, IP, Benutzer, Kanaele
//      gehoeren zum Geraet in der Show, nicht zum Typ. Ein Facet, das sie
//      mitnimmt, veroeffentlicht den Aufbau einer Anlage.
//   3. DER ABGLEICH IST INKREMENTELL. `latestSeq` weiter, `removed` raus,
//      Ungueltiges gezaehlt statt verschluckt, Serverwechsel = neue Kopie.
//
// Dazu: der Client ist die unveraenderte Kopie aus larszu/av-device-library,
// das Release spricht ohne Einstellung https://devices.zumpelars.de an, das
// Token wird nirgends geloggt und in der Desktop-App nur verschluesselt
// abgelegt.
//
// Der Lauf importiert die TypeScript-Dateien direkt — Node 22 zieht die Typen
// beim Laden ab, es braucht keinen Build.
//
// Lauf: `npm run library:check`
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB = 'apps/web/src/lib/deviceLibrary'
const lies = (p) => readFileSync(join(ROOT, p), 'utf8')

const client = await import(`../${LIB}/deviceLibraryClient.ts`)
const typ = await import(`../${LIB}/intercomDeviceType.ts`)
const abgleich = await import(`../${LIB}/librarySync.ts`)

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

const beltpack = () => ({
	format: typ.DEVICE_TYPE_FORMAT,
	version: typ.DEVICE_TYPE_VERSION,
	kind: 'beltpack',
	transports: ['dect', 'ethernet'],
	keys: { pages: 2, perPage: 4 },
	power: ['battery', 'usb-c'],
	audio: { headset: 1 },
})

console.log('Release-Vorgabe und Serveradresse')
check('Vorgabe ist devices.zumpelars.de', client.DEFAULT_DEVICE_LIBRARY_URL === 'https://devices.zumpelars.de')
check('ohne Einstellung gilt die Vorgabe', abgleich.effectiveServer(null) === 'https://devices.zumpelars.de')
check('kaputte Einstellung faellt auf die Vorgabe', abgleich.effectiveServer('kein url') === 'https://devices.zumpelars.de')
check('Schraegstrich am Ende wird abgeschnitten', abgleich.readServerUrl('https://lib.example.org/ ').url === 'https://lib.example.org')
check('http im Netz wird abgelehnt (Token im Klartext)', abgleich.readServerUrl('http://lib.example.org').reason === 'insecure')
check('http auf localhost geht (Entwicklung)', abgleich.readServerUrl('http://localhost:5210').ok === true)
check('Zugangsdaten in der Adresse werden abgelehnt', abgleich.readServerUrl('https://a:b@lib.example.org').ok === false)

console.log('Facet: Lesen und Schreiben sind dieselbe Funktion')
const gelesen = typ.readDeviceType(beltpack())
check('gueltiges Beltpack wird gelesen', gelesen.ok, gelesen.reason)
const eigen = { manufacturer: 'Acme', model: 'BP-1', sourceUrl: 'https://acme.example/bp1.pdf', facet: beltpack() }
const facet = typ.toFacet(eigen)
check('eingereicht = wieder gelesen', JSON.stringify(typ.readDeviceType(facet).facet) === JSON.stringify(facet))
check('Tastenzahl = Seiten × Tasten', typ.keyCount(facet) === 8)
check('Beltpack wird als beltpack angelegt', typ.deviceRoleOf(facet) === 'beltpack')
check('Antenne ist kein Geraet des Kerns', typ.deviceRoleOf({ ...beltpack(), kind: 'antenna' }) === null)

console.log('Facet: keine Projektdaten')
const mitProjekt = typ.toFacet({
	...eigen,
	facet: { ...beltpack(), id: 'bp-7', label: 'Regie', userId: 'u1', channelIds: ['ch1'], network: { ip: '10.0.0.7' }, audio: { headset: 1, inputGainDb: -6 } },
})
const text = JSON.stringify(mitProjekt)
for (const feld of ['bp-7', 'Regie', 'u1', 'ch1', '10.0.0.7', 'inputGainDb']) {
	check(`"${feld}" bleibt draussen`, !text.includes(feld), text)
}

console.log('Facet: Bedeutung, nicht nur Namen')
const abgelehnt = (name, o) => check(name, typ.readDeviceType(o).ok === false)
abgelehnt('neuere Version wird abgelehnt', { ...beltpack(), version: typ.DEVICE_TYPE_VERSION + 1 })
abgelehnt('fremdes Format wird abgelehnt', { ...beltpack(), format: 'fixture profile' })
abgelehnt('unbekannte Art wird abgelehnt', { ...beltpack(), kind: 'walkie' })
abgelehnt('ohne Uebertragung wird abgelehnt', { ...beltpack(), transports: [] })
abgelehnt('unbekannte Uebertragung wird abgelehnt', { ...beltpack(), transports: ['bluetooth'] })
abgelehnt('Beltpack ohne Tasten wird abgelehnt', { ...beltpack(), keys: undefined })
abgelehnt('null Tasten je Seite wird abgelehnt', { ...beltpack(), keys: { pages: 1, perPage: 0 } })
abgelehnt('Antenne ohne DECT wird abgelehnt', { format: typ.DEVICE_TYPE_FORMAT, version: 1, kind: 'antenna', transports: ['ethernet'] })

console.log('Abgleich')
const S = 'https://devices.zumpelars.de'
const geraet = (slug, seq, extra = {}) => ({
	slug, version: 1, seq, removed: false, status: 'unconfirmed', confirmations: 0,
	core: { manufacturer: 'Acme', model: slug, category: 'Intercom', sourceUrl: 'https://acme.example' },
	facet: beltpack(), ...extra,
})
const antwort = (latestSeq, devices) => ({ format: 'avplan-device-sync', version: 1, planner: 'intercom', latestSeq, devices })

let c = abgleich.emptyCache(S)
c = abgleich.applySync(c, antwort(3, [geraet('a', 1), geraet('b', 2), geraet('kaputt', 3, { facet: { format: 'x' } })]))
check('gueltige landen in der Kopie', Object.keys(c.entries).sort().join() === 'a,b')
check('ungueltige werden gezaehlt, nicht verwendet', Object.keys(c.rejected).join() === 'kaputt' && !c.entries.kaputt)
check('latestSeq wird gemerkt', c.latestSeq === 3)
check('Status und Bestaetigungen kommen mit', c.entries.a.status === 'unconfirmed' && c.entries.a.confirmations === 0)

c = abgleich.applySync(c, antwort(6, [
	geraet('a', 5, { removed: true, facet: null }),
	geraet('b', 6, { status: 'verified', confirmations: 3 }),
	geraet('kaputt', 4),
]))
check('removed entfernt', !c.entries.a)
check('neuere Fassung ersetzt die alte', c.entries.b.status === 'verified' && c.entries.b.confirmations === 3)
check('reparierter Eintrag verlaesst die Ablehnungen', !c.rejected.kaputt && !!c.entries.kaputt)
check('latestSeq steigt', c.latestSeq === 6)
check('leere Antwort senkt latestSeq nicht', abgleich.applySync(c, antwort(0, [])).latestSeq === 6)
check('Antwort fuer anderen Planner wird abgelehnt', (() => { try { abgleich.applySync(c, { ...antwort(7, []), planner: 'light' }); return false } catch { return true } })())

const gespeichert = JSON.parse(JSON.stringify(c))
check('Kopie ueberlebt Speichern und Laden', abgleich.cacheFor(gespeichert, S).latestSeq === 6)
check('Serverwechsel verwirft die Kopie', abgleich.cacheFor(gespeichert, 'https://andere.example').latestSeq === 0)
gespeichert.entries.b.type.facet.version = 99
check('unlesbare Kopie erzwingt vollen Abgleich', abgleich.cacheFor(gespeichert, S).latestSeq === 0)

console.log('Einreichen: der Draht')
let gesendet = null
globalThis.fetch = async (url, init) => {
	gesendet = { url, init }
	return new Response(JSON.stringify({ slug: 'acme-bp-1', state: 'pending' }), { status: 200 })
}
await client.propose(S, 'geheim', 'intercom', { manufacturer: 'Acme', model: 'BP-1', category: 'Intercom', sourceUrl: eigen.sourceUrl }, facet)
const body = JSON.parse(gesendet.init.body)
check('geht an /api/proposals', gesendet.url === `${S}/api/proposals`)
check('Facet liegt unter planners.intercom', JSON.stringify(body.data.planners.intercom) === JSON.stringify(facet))
check('Datenblattlink geht mit', body.data.sourceUrl === eigen.sourceUrl)
check('Token nur im Header, nie im Koerper', gesendet.init.headers.authorization === 'Bearer geheim' && !gesendet.init.body.includes('geheim'))

console.log('Quelltext')
const kopie = lies(`${LIB}/deviceLibraryClient.ts`)
check('Client ist die Kopie aus av-device-library', kopie.startsWith('// ───') && kopie.includes('Quelle: larszu/av-device-library, `clients/deviceLibraryClient.ts`'))
const webDateien = [
	...readdirSync(join(ROOT, LIB)).map((f) => `${LIB}/${f}`),
	'apps/web/src/views/DeviceLibrarySettings.tsx',
	'apps/web/src/views/DeviceTypesView.tsx',
]
const mitLog = webDateien.filter((p) => /console\./.test(lies(p)))
check('kein console.* in der Anbindung', mitLog.length === 0, mitLog.join(', '))
const main = lies('apps/desktop/src/main.ts')
check('Desktop legt das Token mit safeStorage ab', main.includes('safeStorage.encryptString') && main.includes('isEncryptionAvailable'))
check('Desktop loggt kein Token', !main.split('\n').some((z) => /console\./.test(z) && /token/i.test(z)))
check('Preload wird geladen und mit ausgeliefert',
	main.includes('preload.cjs') && lies('apps/desktop/electron-builder.js').includes('dist/preload.cjs') && lies('apps/desktop/build.mjs').includes('preload.ts'))
const store = lies(`${LIB}/deviceLibraryStore.ts`)
check('Token geht nie an den Intercom-Kern', !/\/api\//.test(store))

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail ? 1 : 0)
