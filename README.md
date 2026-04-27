# Broadcast Intercom

A self-hosted, browser-based production intercom system for live events and broadcast productions. Inspired by the architecture of [Green-GO](https://green-go.eu) wireless intercoms and the open-source [Eyevinn Open Intercom](https://github.com/Eyevinn/intercom-manager) project.

---

## Features

- **Group channels (Partylines)** — multi-party talk groups, each user can hold up to 8 configurable slots
- **System channels** — three always-present channels: Announcement, Emergency, Program
- **Direct calls** — temporary 1:1 channels that auto-open when a user initiates a call, no pre-configuration on the receiver side
- **User Profiles / Presets** — per-user slot configuration (which groups/direct targets/system channels appear on each slot)
- **Device Manager** — hardware beltpacks (Ethernet/DECT/WiFi) with full config; browser beltpacks via invite link
- **Companion / StreamDeck control** — REST control endpoint compatible with [Bitfocus Companion](https://bitfocus.io/companion)
- **Audio transcription** — optional Vosk speech-to-text per channel
- **Plugin Bridge** — optional VST/audio plugin integration via WebSocket

---

## Architecture

```
Broadcast intercom/
├── apps/
│   ├── server/          Node.js 20 + Express + WebSocket (port 4000)
│   └── web/             React + Vite 6 (HTTPS port 5173)
├── packages/
│   └── shared/          Common TypeScript types (shared between server & web)
└── data/
    ├── configs/         Saved show configurations (JSON)
    └── models/          Vosk speech model (optional)
```

**Tech stack:**
- Runtime: Node 20.20.2 (via [fnm](https://github.com/Schniz/fnm))
- Server: Express 4, `ws` WebSocket library, `tsx` for TypeScript execution
- Frontend: React 18, Vite 6, CSS-only styling (no CSS framework)
- HTTPS: [mkcert](https://github.com/FiloSottile/mkcert) local CA

---

## Getting Started

### Prerequisites

```powershell
winget install Schniz.fnm
fnm install 20
fnm use 20
winget install FiloSottile.mkcert
mkcert -install
```

### Installation

```powershell
git clone https://github.com/larszu/Broadcast-intercom.git
cd "Broadcast-intercom"
npm install

# Generate HTTPS certificates
cd apps/web
mkdir certs
mkcert -cert-file certs/localhost+4.pem -key-file certs/localhost+4-key.pem localhost 127.0.0.1 ::1 YOUR_LAN_IP
cd ../..
```

### Running

```powershell
npm run dev
```

Open `https://localhost:5173` in your browser.

---

## Green-GO Inspired Concepts

| Concept | This System |
|---|---|
| Group (Partyline) | `IntercomGroup` + `Channel` with `type: "group"` |
| Direct Call | `TemporaryChannel` — auto-created, no receiver pre-config needed |
| User Config | `UserProfile` with `ChannelSlot[]` (up to 8 slots per user) |
| System Channels | `__sys_announcement__`, `__sys_emergency__`, `__sys_program__` — always present |
| Channel Slot | `ChannelSlot` — each slot points to a group, direct target, or system channel |

Each slot in a `UserProfile` can be one of:
- `{ type: "group", groupId }` — talk/listen to a group
- `{ type: "direct", userId }` — dedicated button for direct call to a user
- `{ type: "system", channelId }` — always-on system channel

---

## Eyevinn-Inspired Concepts

| Eyevinn Term | This System |
|---|---|
| Production | Config / Show configuration |
| Line | Channel / Group |
| Preset | `UserProfile` |
| Session/Participant | `ClientSession` |
| Companion Actions | `ControlAction` via `POST /api/control/action` |

---

## API Reference

### WebSocket (`ws://localhost:4000`)

**Client → Server:**

| Type | Payload |
|---|---|
| `register_device` | `{ id, label, transport, role?, userId?, channelIds? }` |
| `heartbeat` | `{ id, battery?, network? }` |
| `set_talk` | `{ id, channelId, active }` |
| `set_listen` | `{ id, channelIds }` |
| `set_user` | `{ id, userId? }` |
| `direct_call` | `{ fromDeviceId, toUserId }` |
| `direct_call_end` | `{ tempChannelId }` |
| `transcribe_audio` | `{ id, channelId, sampleRate, audio }` |

**Server → Client:**

| Type | Payload |
|---|---|
| `state` | Full `CoreState` |
| `event` | `EventItem` |
| `audio_chunk` | `{ fromDeviceId, channelId, sampleRate, audio }` |
| `temp_channel_opened` | `TemporaryChannel` |
| `temp_channel_closed` | `{ tempChannelId }` |

### REST Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/state` | Full state |
| GET/POST | `/api/users` | List / create users |
| PATCH/DELETE | `/api/users/:id` | Update / delete user |
| POST | `/api/channels` | Create channel |
| PATCH/DELETE | `/api/channels/:id` | Update / delete channel |
| GET/POST | `/api/groups` | List / create groups |
| PATCH/DELETE | `/api/groups/:id` | Update / delete group |
| GET/POST | `/api/profiles` | List / create profiles |
| PATCH/DELETE | `/api/profiles/:id` | Update / delete profile |
| GET | `/api/sessions` | Active WebSocket sessions |
| POST | `/api/control/action` | Companion control action |
| POST | `/api/devices` | Add device |
| PATCH/DELETE | `/api/devices/:id` | Update / delete device |
| GET/PATCH | `/api/audio/plugin-bridge` | Plugin bridge config |
| GET | `/api/network/hosts` | LAN IP addresses |
| GET | `/api/fs/list?path=` | Server-side file browser |

**`ControlAction` values:**
`ptt_start`, `ptt_stop`, `mute_input`, `mute_output`, `set_selected_slot`, `volume_up`, `volume_down`, `direct_call_start`, `direct_call_end`, `emergency_start`, `emergency_stop`

---

## License

MIT
