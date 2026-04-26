# Future Feature Requests

## Transcription and Language
- Add multilingual live translation pipeline for transcript lines (German/English first).
- Add per-channel custom phrase dictionaries and shortcut expansions.
- Add confidence scoring and low-confidence highlighting for transcript lines.
- Add transcript recording sessions with searchable timeline and export to JSON/SRT/TXT.

## Automation and Integrations
- Add keyword rule engine with actions (OSC, MIDI, webhook, local command).
- Add rule presets for show-caller, FOH, monitor engineer, and stage manager workflows.
- Add bidirectional OSC status feedback into UI indicators.
- Add optional external STT gateway mode for dedicated transcription hosts.

## Operator UX
- Add dedicated transcript view with channel filters, pinned channels, and unread markers.
- Add type-to-speak with configurable TTS voice and channel routing.
- Add global keyboard macro profiles (per production profile).
- Add transcript bookmarks and incident markers for post-show reports.

## Reliability and Ops
- Add transcription health panel (model status, CPU load, dropped frames, latency).
- Add offline model manager with one-click language model download/update.
- Add back-pressure and adaptive chunking for low-bandwidth links.
- Add role-based permissions for who may enable transcription per channel.

## Hardware and Routing
- Add input routing bridge for external audio interfaces and virtual audio devices.
- Add optional per-channel AGC/noise suppression stage before STT.
- Add multi-device speaker diarization for shared channels.
- Add configurable retention policy for transcript data and event logs.

## DECT Client Roadmap
- Implement real DECT beltpack client stack (registration, heartbeat, channel sync).
- Add DECT antenna roaming and handover behavior testing.
- Add battery and charging telemetry from physical DECT clients.
- Add RF quality visualization and alarm thresholds in dashboard.

## Web and Phone Client Backlog
- Add PWA packaging for the Phone Client (home screen install, wake-lock, offline shell).
- Add push-to-talk lock mode optimized for touchscreen operation.
- Add one-tap role presets (FOH, Stage, Camera, Director) for web clients.
- Add admin option to provision/revoke web clients as managed devices.

## Audio Plugin and Processing Strategy
- Support per-end-device plugin chains (local browser/native host per client).
- Support central plugin host with multi-client routing and reusable chain presets.
- Add hybrid mode: edge preprocessing (client) plus central mastering chain.
- Add plugin capability negotiation (which client can host which format/CPU budget).

## Ideas Collected From This Chat
- Add dedicated DECT hardware client implementation after web/phone stabilization.
- Keep ProdCom-like features as optional overlays (translation, automation, typed reply).
- Add OSC/MIDI keyword triggers with channel-scoped automation rules.
- Add transcript-to-action incidents and operator bookmark workflows.
