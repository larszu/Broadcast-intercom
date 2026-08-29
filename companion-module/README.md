# Broadcast Intercom — Bitfocus Companion module

A [Bitfocus Companion](https://bitfocus.io/companion) connection module for the
[Broadcast Intercom](../README.md) core server. It lets a Stream Deck (or any
Companion surface) act as a hardware control panel for the intercom:
push-to-talk, mute, volume, direct calls and emergency, with live button
feedback for talk state, battery, emergency and connection health.

## How it works

```
 Stream Deck ──► Companion ──► this module ──┬─ POST /api/control/action   (commands)
                                             └─ WS  /ws                     (live state + direct calls)
                                                        │
                                                        ▼
                                              Broadcast Intercom core (:4001)
```

- **Commands** (PTT, mute, volume, emergency) go to the Companion-compatible
  `POST /api/control/action` endpoint.
- **Live state** is streamed over the same `/ws` WebSocket the operator UI uses,
  so feedback updates instantly. A REST poll of `GET /api/state` runs as a
  fallback when the socket is unavailable.
- **Direct calls** and **talk-on-named-channel** are sent as native WebSocket
  messages (`direct_call`, `direct_call_end`, `set_talk`).

See [`companion/HELP.md`](companion/HELP.md) for the full list of actions,
feedbacks, variables and presets.

## Install for development

Companion loads "developer" modules from a folder you point it at.

1. Build the intercom core and start it (defaults to port `4001`):
   ```bash
   # from the repository root
   npm install
   npm run dev:server
   ```
2. Install this module's dependencies:
   ```bash
   cd companion-module
   npm install
   ```
3. In Companion, open **Settings → Developer modules path** and select the
   folder that *contains* this `companion-module` directory (or copy this
   directory into your configured dev-modules path).
4. Add a connection: **Connections → Add → Broadcast Intercom**, then set the
   core **Host** and **Port**.

## Build a distributable package

```bash
npm run build:manifest      # or: npx companion-module-build
```

This produces `broadcast-intercom-<version>.tgz`, the package format Companion
imports via **Import custom module**.

## Validate & test

```bash
npm run check               # node --check on every source file
npx companion-module-check  # validate manifest + module against the framework

# End-to-end against a running core on 127.0.0.1:4001:
node test/integration.mjs
```

`test/integration.mjs` mocks the Companion host and drives the real module logic
(connection, actions, feedbacks, variables) against a live core — verifying that
PTT, mute/unmute, emergency and the derived feedbacks all round-trip correctly.

## Compatibility

- Companion 3.x (module API `@companion-module/base` v1.12, node18 runtime).
- Broadcast Intercom core v0.1.0+.

## License

Proprietär — © 2026 Lars Zumpe, alle Rechte vorbehalten. Nutzung der veröffentlichten Builds ist kostenlos; Weiterverbreitung und abgeleitete Werke sind es nicht. Siehe [LICENSE](LICENSE).
