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
connection-status indicator. After dropping a preset, pick the target device in
the button's action/feedback options.
