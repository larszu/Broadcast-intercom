# Broadcast Intercom

Control a [Broadcast Intercom](https://github.com/larszu/Broadcast-intercom) core
server from a Stream Deck (or any Companion surface): push-to-talk, mute, volume,
direct calls and emergency — with live talk / battery / emergency feedback.

## Configuration

| Field | Description |
|---|---|
| **Core Host / IP** | Hostname or IP of the intercom core (the machine serving the operator UI). Default `127.0.0.1`. |
| **Core Port** | The core's HTTP/WebSocket port. Default `4001`. |
| **State poll fallback (ms)** | Backup REST polling interval, used only when the live WebSocket is unavailable. Default `2000`. |

The module keeps a live WebSocket connection to `/ws` so button feedback (talk
state, battery, emergency) updates instantly. Control commands are sent to the
core's `POST /api/control/action` endpoint; direct calls and talk-on-a-named-
channel are sent over the same WebSocket the operator UI uses.

## Actions

| Action | Notes |
|---|---|
| **Push-to-talk (PTT)** | Talk / release / toggle on a device slot (0–7). Use *Talk* on button down and *Release* on button up for classic momentary PTT. |
| **Talk on named channel** | Talk on a specific channel by id instead of a slot index. |
| **Mute / unmute audio** | Mute or restore input (mic) or output (headphones). |
| **Volume up / down** | ±3 dB on the device output. |
| **Emergency** | Activate / deactivate / toggle the emergency channel. |
| **Direct call — start** | Open a temporary 1:1 channel from a device to a user. |
| **Direct call — end** | Close an active direct call. |
| **Load show configuration** | Load a saved config by name on the core. |

## Feedbacks

| Feedback | Turns the button… |
|---|---|
| **Device is talking** | green while the device has an open talk channel (optionally on a specific channel). |
| **Device is muted** | red when the chosen input/output is muted (≤ -60 dB). |
| **Device is offline** | red when the network link reports offline. |
| **Battery low** | amber when a wireless battery drops below a threshold (ignored while charging). |
| **Emergency active** | red while the emergency channel is active. |
| **Connected to core** | green while the module has a live connection. |

## Variables

Global: `connection`, `active_config`, `device_count`, `user_count`,
`channel_count`, `talking_count`, `emergency`, `direct_call_count`.

Per device (id sanitised to letters/numbers/underscore): `device_<id>_label`,
`device_<id>_talking`, `device_<id>_talk_channel`, `device_<id>_battery`,
`device_<id>_online`.

## Presets

Ready-to-drop buttons under *Push-to-talk*, *Audio* and *System*: PTT (hold),
PTT (toggle), Mute microphone, Volume up/down, Emergency toggle, and a core
connection-status indicator. After dropping one of these, pick the target device
in the button's action/feedback options.

### Buttons derived from the loaded plan

Two further categories appear as soon as the module reaches a core that has a
plan loaded, and they need **no** picking afterwards:

- **Plan · Sprechstellen** — one *PTT* and one *Mic mute* button per beltpack,
  already bound to that beltpack, labelled with its real name. PTT is a hold
  button, not a toggle: a latched talk button that nobody released is an open
  microphone in the control room.
- **Plan · Kanäle** — one *talk on channel* button per beltpack **that actually
  carries the channel**. A beltpack that does not carry it gets no button
  instead of a guessed one, because a guessed talk button opens the wrong
  microphone on the wrong channel.

The list is rebuilt whenever the core's device/user/channel set changes, so a
new show configuration brings its own buttons with it — nothing is copied and
hand-tweaked per show variant.

If a core carries more beltpacks or channels than the list holds (64 per kind),
the module writes a warning to its log naming how many were left out. It never
truncates silently.
