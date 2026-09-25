# Device library (`devices.zumpelars.de`)

The shared device library of the AV Planner Suite keeps one entry per device:
a core every planner shares (manufacturer, model, category, datasheet) and one
**facet** per planner in that planner's own format. This page describes the
`intercom` facet and how this system reads and writes it.

Code: [`apps/web/src/lib/deviceLibrary/`](../apps/web/src/lib/deviceLibrary/).
The client `deviceLibraryClient.ts` is an unchanged copy of
`clients/deviceLibraryClient.ts` from `larszu/av-device-library`; changes go
there first.

## Account

Reading the library needs an account. Accounts are created on the website
(**Create account** in the settings opens it), not in this app.

**Setup → Settings & Logs → Device library**

- **Server** — `https://devices.zumpelars.de` unless changed. Only `https://`
  addresses are accepted (plain `http://` only for `localhost`), because the
  sign-in token travels with every request. **Reset to default** returns to the
  release address. A new address is a new library: the token and the local copy
  of the old one are dropped.
- **Sign in** with email or username and password. With two-factor sign-in
  enabled, a second step asks for the code from the authenticator app.
- **Sign out** forgets the token, also when the library is not reachable.

Every error code of the client has its own message. Two need action on the
website: *guidelines outdated* (the community guidelines changed — the message
links to `<server>/guidelines` to accept them again) and, when submitting,
*already in the library* (HTTP 409 — confirm or correct the existing entry
there instead of submitting a second one).

The token is kept per operator UI, never in a show config and never sent to the
intercom core:

| Where the UI runs | Where the token lives |
|---|---|
| Desktop app | encrypted with Electron `safeStorage` (Keychain / DPAPI) in the user-data folder. Without OS encryption nothing is written; the sign-in lasts until the app closes. |
| Browser | `localStorage` of the core's address |

## Device types

**Setup → Device types** lists two sources side by side:

- **Own device types** — created and edited here, stored in the browser
  (`localStorage`). **Submit to library** sends one as a proposal; it needs a
  link to the manufacturer datasheet and appears for others after moderation.
- **From the device library** — read-only. **Sync** fetches everything after
  the last known `latestSeq`; entries marked `removed` disappear, the copy is
  kept across restarts. Each entry shows its status (verified, confirmed,
  unconfirmed, disputed), the number of confirmations and a link to its page in
  the library. **Copy as own** starts an own type from it.

Entries the library delivers but this planner's check refuses are **counted and
listed** under *Delivered but not usable here*, with the reason — never used,
never silently dropped.

**Add device** (Setup → Devices & Users) offers both sources as *Device type*:
picking one sets the role (beltpack or station), limits the transports to the
type's, and fills the label with the model.

## The `intercom` facet

The facet **is** this planner's device type. Submitting writes it with
`toFacet`, syncing reads it with `readDeviceType` — the same function checks
both directions (`intercomDeviceType.ts`).

```json
{
  "format": "intercom-device-type",
  "version": 1,
  "kind": "beltpack",
  "transports": ["dect", "ethernet"],
  "keys": { "pages": 2, "perPage": 4 },
  "power": ["battery", "usb-c"],
  "audio": { "headset": 1, "speaker": false },
  "protocols": ["aes67"]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | always `intercom-device-type` |
| `version` | yes | `1`. A newer version is refused, not guessed. |
| `kind` | yes | `beltpack`, `deskstation`, `antenna`, `interface` |
| `transports` | yes, ≥ 1 | how the device reaches the core: `ethernet`, `dect`, `wifi` (the core's `TransportType`) |
| `keys` | beltpack, deskstation | key grid: `pages` (1–32) × `perPage` (1–64) — the same page/button grid as `PlanKey` in `avplan-intercom` v2 |
| `dectCapacity` | — | antennas: beltpacks one antenna carries at once (1–1000) |
| `power` | — | `poe`, `battery`, `usb-c`, `mains` |
| `audio` | — | `headset`, `lineIn`, `lineOut` (0–64), `speaker` (true/false) |
| `protocols` | — | `aes67`, `dante`, `sip`, `gpio`, `2-wire`, `4-wire` |

An antenna must list `dect`. Unknown values are refused; unknown fields are
dropped.

**No project data.** Label, device ID, IP address, user, channel assignment,
antenna link, audio levels — all of that belongs to a device in a show config
(`BeltpackDevice`), not to its type. The facet is built field by field from the
table above, so none of it can pass through; `npm run library:check` proves it.

**Relation to `avplan-intercom`.** The vendor-neutral plan file
([plan-import.md](plan-import.md)) describes a *show*: conferences, stations,
memberships, keys. The facet describes the *hardware* a station runs on and
reuses the plan's vocabulary for it (transports, the key grid). A plan station
does not reference a device type; that link stays with the device in this
system.

## Where it is checked

`npm run library:check` (in CI): release default, address rules, facet round
trip, project fields kept out, version/kind/transport refused by meaning,
incremental sync with `removed` and refused entries, cache bound to its server,
the proposal on the wire, the library's error codes (each with a text in both languages), no logging of the token, `safeStorage` in the desktop
app.
