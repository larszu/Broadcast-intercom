# Architecture draft (v0)

## Goal

One intercom platform with two beltpack types:

- DECT wireless beltpack (battery + USB-C charging)
- PoE Ethernet beltpack (wired)

Both connect to one central core and one DECT antenna/base system.

## Components

1. Core server (Raspberry Pi 5 or x86)
- Device registry and auth
- Channel/group/room model
- Talk/listen/call control events
- Monitoring and configuration API

2. Beltpack firmware/app (shared logic)
- Common state machine and UI behavior
- Transport adapters: DECT, Ethernet, optional Wi-Fi fallback
- Audio device abstraction (XLR-4 headset path)

3. DECT antenna/base subsystem
- Registers as an "antenna gateway" in core
- Tracks attached wireless beltpacks
- Relays control/audio session metadata

4. Operator UI
- Device health (battery, charging, link)
- Channel assignment and talk/listen state
- Event timeline and quick controls

## Control and data flow

1. Beltpack registers to core (`register_device`).
2. Core assigns channel role/profile.
3. Beltpack sends heartbeat and talk/listen changes.
4. Core resolves listeners for active talkers and broadcasts events.
5. UI subscribes over WebSocket for live state.

## Transport model

- `ethernet`: PoE powered wired units (primary stable path)
- `dect`: wireless units via antenna/base gateway
- `wifi`: optional fallback for development/non-critical workflows

## Power model

- DECT beltpacks: battery, charging over USB-C
- PoE beltpacks: external PoE split/PD path to 5V logic rail

## Audio model (phase-based)

Phase 1 (this prototype): control/state only

Phase 2:
- Full duplex audio sessions with Opus + RTP/WebRTC transport
- sidetone, mic gain, limiter, headset profile presets

Phase 3:
- Gateway integration for external systems (AES67/Dante boundary)

## Roadmap

1. Stabilize shared control protocol
2. Add real beltpack device client process
3. Add audio transport worker
4. Add persistent config profiles and role templates
5. Add OTA update path and diagnostics
