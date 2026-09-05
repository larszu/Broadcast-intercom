# Intercom plan import (`avplan-intercom`)

The AV Planner Suite plans intercom as part of the show: which conferences exist,
which stations hang on them, and — separately per membership — whether a station
**talks** or only **listens**. Since `cable-planner#684` the Cable Planner
exports that as a vendor-neutral file. This page describes how this system reads
it.

Before, nobody read it. Whoever planned the system typed the conferences in a
second time — exactly the double entry the format was written against.

## What the file looks like

```json
{
  "format": "avplan-intercom",
  "version": 1,
  "systemName": "Halle A",
  "exportedAt": "2026-09-05T12:00:00.000Z",
  "channels": [
    { "id": "ch-1", "name": "PGM" },
    { "id": "ch-2", "name": "CAM" }
  ],
  "stations": [
    {
      "id": "st-1",
      "name": "Regie",
      "memberships": [
        { "channelId": "ch-1", "talk": true,  "listen": true },
        { "channelId": "ch-2", "talk": false, "listen": true }
      ]
    }
  ],
  "derivedFrom": "Green-GO configuration. There, membership is ONE list; talk and listen are therefore both set and not measured separately."
}
```

`derivedFrom` is not decoration. A file derived from a Green-GO configuration
has `talk` and `listen` both set, because Green-GO keeps membership as a single
list. That is the poorer source, not a measurement — the import shows the
sentence rather than swallowing it, so nobody carries a talk permission into a
foreign system believing it was planned that way.

## Where to find it

**Setup → Plan Import.** Pick the file, press **Compare**, read what would
change, then **Apply**. The apply button only appears after a comparison: an
import writes talk permissions into a system somebody is about to work on.

## The two endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/plan/preview` | Returns the diff. Changes nothing. |
| `POST` | `/api/plan/apply` | Applies the plan, saves the config, broadcasts the new state. Returns the same diff. |

Body: `{ "plan": <the file as an object or as text> }`. Both are accepted so
that reading a file by hand and forwarding JSON from another program do not need
two endpoints. A file that is not `avplan-intercom` is answered with `400` and a
sentence saying so.

## The rules the import follows

**Merged by name, not by the file's id.** `ch-3` means nothing on this system;
`PGM` means something, because that is what gets said in the control room.
Matching on the file id would duplicate everything on the second import. Names
are compared trimmed and case-insensitively — nothing beyond that, because two
channels genuinely called `CAM-1` and `CAM 1` may well be two.

**Nothing is ever deleted.** What the plan does not name stays and is listed
under *Not in the plan*. This is the opposite decision from the tally path in the
suite, where devices the plan does not name disappear — and it falls the other
way here because this server owns things a plan cannot reconstruct: devices,
antennas, assignments, running sessions.

**System channels are untouchable.** Announcement, Emergency and Program are
properties of the system, not planned conferences.

**Talk and listen stay separate.** A membership with `listen: true, talk: false`
produces exactly that. A missing flag counts as *not set* — inventing a talk
permission is the more expensive mistake.

**New stations become `operator`.** The plan carries no roles in this system's
sense. Deriving a role from a name ("Regie" → `director`) would be the wrong kind
of helpfulness; whoever wants that sets it afterwards.

**Colours are deterministic.** A channel already here keeps its colour — the name
is the key, the colour belongs to the system. A new channel takes the colour from
`vendor.greengo.groupColors` when the file carries a real hex value, otherwise
the next one from a fixed palette. Re-importing the same file therefore never
reshuffles the colours people navigate by on the device.

**Memberships pointing at a conference the file does not define** are skipped and
listed under *Memberships without a conference*. Not an error of this server, but
not something that may silently vanish either.

## Where it is checked

`npm run test:smoke` (against a running `npm run dev:server`) covers both
endpoints end to end: merging an existing channel written differently, creating a
new one, talk/listen kept apart, system channels and unknown devices surviving,
the preview changing nothing, and a second apply of the same file adding nothing
and keeping the colours.
