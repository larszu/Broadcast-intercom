# Documentation

| Document | What it covers |
|---|---|
| [`../README.md`](../README.md) | Project overview, getting started, headless testing, full REST + WebSocket API reference, environment variables |
| [`architecture.md`](architecture.md) | Design/vision draft: hardware model, transport model, audio phases, roadmap |
| [`future-feature-requests.md`](future-feature-requests.md) | Backlog of planned features and ideas |
| [`../companion-module/README.md`](../companion-module/README.md) | Bitfocus Companion module — how it works, install, build, test |
| [`../companion-module/companion/HELP.md`](../companion-module/companion/HELP.md) | Companion module reference: actions, feedbacks, variables, presets |

## Quick reference

- **Core server:** `apps/server` — Express + WebSocket on port `4001` (`PORT` to override)
- **Operator UI:** `apps/web` — React + Vite dev server on port `5200`
- **Shared types:** `packages/shared` — the `CoreState`, message and entity types used by everything
- **Companion module:** `companion-module` — Stream Deck control surface
- **Headless test:** `npm run test:smoke` (against a running `npm run dev:server`)

## Data flow at a glance

```
 Beltpack / Web client ─┐
 Stream Deck (Companion)─┤   REST  POST /api/*          ┌─ data/configs/*.json   (persisted show configs)
                         ├──────────────────────────►  │
                         │   WS    /ws  (live state)    └─ in-memory CoreState   (broadcast to all clients)
 Operator UI ───────────┘
```

Every mutation (REST or WebSocket) updates the single in-memory `CoreState` and
is broadcast to all connected clients as a `state` message, plus an `event` for
the timeline. Show configurations are persisted to `data/configs/` as JSON.
