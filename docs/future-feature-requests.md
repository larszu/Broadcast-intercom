# Future Feature Requests

Status as of 2026-09-27. **Done** names the pull request. **Partly** says which
part exists. **Deferred** gives the reason; an entry without a status line is
open.

## Transcription and Language
- Add multilingual live translation pipeline for transcript lines (German/English first).
  — *Deferred:* needs a translation model on the core or a paid online service; neither is chosen.
- Add per-channel custom phrase dictionaries and shortcut expansions.
  — *Deferred:* a Vosk grammar narrows recognition to the listed words and silences everything else; needs trials with real show audio first.
- Add confidence scoring and low-confidence highlighting for transcript lines.
  — *Deferred:* thresholds can only be set against real recordings; CI has no model.
- Add transcript recording sessions with searchable timeline and export to JSON/SRT/TXT.
  — *Done* (#31): transcript log of 5,000 lines, search, export TXT/SRT/JSON, *Clear transcript* starts a new session.

## Automation and Integrations
- Add keyword rule engine with actions (OSC, MIDI, webhook, local command).
  — *Done for OSC and webhook* (#33). No MIDI (native module on every host; bridge from OSC instead) and no local command (a transcript line must not choose what runs on the core).
- Add rule presets for show-caller, FOH, monitor engineer, and stage manager workflows.
  — *Deferred:* a preset needs the real target's OSC addresses (console, playback); invented ones would fire the wrong cue.
- Add bidirectional OSC status feedback into UI indicators.
- Add optional external STT gateway mode for dedicated transcription hosts.

## Operator UX
- Add dedicated transcript view with channel filters, pinned channels, and unread markers.
  — *Done* (#31; the view and filters existed, pinning and unread counts added).
- Add type-to-speak with configurable TTS voice and channel routing.
- Add global keyboard macro profiles (per production profile).
- Add transcript bookmarks and incident markers for post-show reports.
  — *Done* (#31): bookmarks with a note in the transcript timeline, included in every export.

## Reliability and Ops
- Add transcription health panel (model status, CPU load, dropped frames, latency).
  — *Partly:* model status and the reason transcription is off are shown in the transcript view; load, dropped frames and latency are open.
- Add offline model manager with one-click language model download/update.
  — *Partly:* one-click install of the small English and German Vosk models; updates and other languages are open.
- Add back-pressure and adaptive chunking for low-bandwidth links.
  — *Deferred:* needs measurements on a real weak link.
- Add role-based permissions for who may enable transcription per channel.
  — *Done:* per-user `transcriptionChannelIds` in the user permissions.

## Hardware and Routing
- Add input routing bridge for external audio interfaces and virtual audio devices.
  — *Needs hardware* to build and test against.
- Add optional per-channel AGC/noise suppression stage before STT.
  — *Deferred:* whether it helps recognition can only be judged on real audio.
- Add multi-device speaker diarization for shared channels.
- Add configurable retention policy for transcript data and event logs.
  — *Partly:* fixed limits (300 events, 5,000 transcript lines since #31) and manual clearing; configurable retention is open.

## DECT Client Roadmap
*Needs DECT hardware* (base stations, beltpacks) for every item below; nothing here can be built or tested against the simulator alone.
- Implement real DECT beltpack client stack (registration, heartbeat, channel sync).
- Add DECT antenna roaming and handover behavior testing.
- Add battery and charging telemetry from physical DECT clients.
- Add RF quality visualization and alarm thresholds in dashboard.

## Web and Phone Client Backlog
- Add PWA packaging for the Phone Client (home screen install, wake-lock, offline shell).
  — *Done* (#32).
- Add push-to-talk lock mode optimized for touchscreen operation.
  — *Done:* slide the PTT bar to the end to latch it (`PttSlider`).
- Add one-tap role presets (FOH, Stage, Camera, Director) for web clients.
  — *Partly:* onboarding picks a user, whose profile sets the slots; named role presets are open.
- Add admin option to provision/revoke web clients as managed devices.
  — *Done* (#34): invite link and QR code provision; revoke and restore in the Device Manager.

## Audio Plugin and Processing Strategy
*Deferred as a group:* these are alternatives for where plugins run. The Plugin Bridge exists; which of the models below follows is a decision for the product owner, not a task.
- Support per-end-device plugin chains (local browser/native host per client).
- Support central plugin host with multi-client routing and reusable chain presets.
- Add hybrid mode: edge preprocessing (client) plus central mastering chain.
- Add plugin capability negotiation (which client can host which format/CPU budget).

## Ideas Collected From This Chat
- Add dedicated DECT hardware client implementation after web/phone stabilization.
  — *Needs DECT hardware*, see above.
- Keep ProdCom-like features as optional overlays (translation, automation, typed reply).
  — Held: transcription, bookmarks and keyword rules are all off until configured.
- Add OSC/MIDI keyword triggers with channel-scoped automation rules.
  — *Done for OSC* (#33), see keyword rule engine.
- Add transcript-to-action incidents and operator bookmark workflows.
  — *Done* (#31 bookmarks, #33 actions).
