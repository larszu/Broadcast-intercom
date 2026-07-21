export type TransportType = "ethernet" | "dect" | "wifi";
export type DeviceRole = "beltpack" | "deskstation";
export type UserRole = "admin" | "director" | "operator" | "talent";

/**
 * Channel types — Green-GO inspired:
 *   "group"        – Partyline / Ringleitung: alle Teilnehmer sprechen gleichzeitig
 *   "direct"       – Private 1:1-Leitung zu einem anderen User
 *   "announcement" – Systemkanal: immer passiv verfügbar, nur empfangen
 *   "emergency"    – Systemkanal: immer passiv verfügbar, Priorität über alle anderen
 *   "program"      – Systemkanal: Program Audio, nur empfangen
 */
export type ChannelType = "group" | "direct" | "announcement" | "emergency" | "program";

/** Die 3 fest reservierten System-Kanal-IDs */
export const SYSTEM_CHANNEL_ANNOUNCEMENT = "__sys_announcement__";
export const SYSTEM_CHANNEL_EMERGENCY    = "__sys_emergency__";
export const SYSTEM_CHANNEL_PROGRAM      = "__sys_program__";

export interface BatteryState {
  percent: number;
  charging: boolean;
  source: "usb-c" | "battery" | "poe";
}

export interface NetworkState {
  online: boolean;
  signal?: number;
  ip?: string;
  latencyMs?: number;
}

export interface AudioSettings {
  inputGainDb: number;
  outputGainDb: number;
  sidetonePercent: number;
  noiseGateDb: number;
  limiterEnabled: boolean;
}

export interface UserPermissions {
  talkChannelIds: string[];
  listenChannelIds: string[];
  transcriptionChannelIds: string[];
  canAllCall: boolean;
  canManageDevices: boolean;
}

/**
 * Wie eine Talk-Taste sich verhält (Green-GO "ReplyMode"):
 *   "ptt"       – Momentary: sprechen nur solange gedrückt/gehalten
 *   "latch"     – Rastend: einmal antippen an, erneut antippen aus
 *   "handsfree" – Dauersprechen (offenes Mikro), bis manuell beendet
 */
export type ReplyMode = "ptt" | "latch" | "handsfree";

/**
 * Wann ein eingehender Ruf/Talk automatisch als Popup angezeigt wird
 * (Green-GO "PopupMode"):
 *   "off"  – nie automatisch aufpoppen
 *   "call" – nur bei Direktrufen aufpoppen
 *   "talk" – nur bei aktivem Talk auf einem gehörten Kanal aufpoppen
 *   "all"  – bei Rufen und Talk aufpoppen
 */
export type PopupMode = "off" | "call" | "talk" | "all";

/**
 * Advanced Call Behavior — pro User konfigurierbares Ruf-/Talk-Verhalten,
 * abgeleitet aus dem Green-GO gg5 `Settings`-Block einer Station.
 * Wird im State gehalten, propagiert an alle Clients des Users und in der
 * Config persistiert.
 */
export interface CallBehaviorSettings {
  /** Talk-Tasten-Verhalten (momentary/rastend/handsfree). */
  replyMode: ReplyMode;
  /**
   * Wie stark andere Kanäle abgesenkt werden, während ein Prioritäts-/
   * Notfall-Talk aktiv ist, in dB (<= 0). Green-GO "PriorityDim".
   */
  priorityDimDb: number;
  /**
   * Isolate/Solo: nur der aktuell gewählte Kanal wird gehört, alle anderen
   * werden stummgeschaltet. Green-GO "Isolate".
   */
  isolate: boolean;
  /**
   * Wie lange eine Ruf-/Cue-Anzeige stehen bleibt, in Sekunden.
   * Green-GO "CueTimeout".
   */
  cueTimeoutSec: number;
  /** Popup-Verhalten bei eingehenden Rufen/Talk. Green-GO "PopupMode". */
  popupMode: PopupMode;
  /** Ob bei eingehendem Ruf ein Alarmton abgespielt wird. Green-GO "AlertTone". */
  alertTone: boolean;
  /** Pegel des Alarm-/Ruftons in dB (<= 0). Green-GO "ToneLevel". */
  toneLevelDb: number;
  /**
   * Automatische Freigabe eines rastenden Talks nach N Sekunden
   * (0 = nie automatisch freigeben). Green-GO "ActiveTime".
   */
  activeTimeSec: number;
}

/** Standard-Werte für Advanced Call Behavior (an Green-GO-Defaults angelehnt). */
export const defaultCallBehavior = (): CallBehaviorSettings => ({
  replyMode: "ptt",
  priorityDimDb: -6,
  isolate: false,
  cueTimeoutSec: 3,
  popupMode: "call",
  alertTone: false,
  toneLevelDb: -12,
  activeTimeSec: 0,
});

export interface IntercomUser {
  id: string;
  name: string;
  role: UserRole;
  color: string;
  permissions: UserPermissions;
  /** Advanced Call Behavior (Ruf-/Talk-Verhalten), siehe CallBehaviorSettings. */
  callBehavior: CallBehaviorSettings;
  assignedDeviceIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BeltpackDevice {
  id: string;
  label: string;
  role: DeviceRole;
  transport: TransportType;
  userId?: string;
  channelIds: string[];
  talkChannelId?: string;
  listenChannelIds: string[];
  transcriptionChannelIds?: string[];
  battery: BatteryState;
  network: NetworkState;
  audio: AudioSettings;
  connectedAntennaId?: string;
  lastSeenAt: number;
}

export interface DectAntenna {
  id: string;
  label: string;
  location: string;
  online: boolean;
  connectedDeviceIds: string[];
  lastSeenAt: number;
}

export interface Channel {
  id: string;
  name: string;
  color: string;
  /** Kanaltyp — bestimmt das Routing-Verhalten */
  type: ChannelType;
  /**
   * Nur relevant wenn type="direct": ID des Ziel-Users.
   * Routing-Regel: Nur Geräte, die mit diesem User verknüpft sind, nehmen an der
   * Kommunikation teil. Falls der Empfänger den Sender nicht konfiguriert hat,
   * wird ein temporärer Kanal geöffnet (siehe TemporaryChannel).
   */
  targetUserId?: string;
  /**
   * Nur relevant wenn type="group": IDs der User in dieser Gruppe.
   * User werden NICHT der Gruppe zugeordnet — stattdessen legt jeder User
   * die Gruppe auf einem seiner Kanäle ab (groupId im Channel-Slot).
   */
  memberUserIds?: string[];
}

/**
 * Eine Gruppe (Partyline / Ringleitung).
 * User werden nicht der Gruppe zugeordnet — jeder User legt die Gruppe
 * eigenständig auf einem seiner Kanäle ab.
 */
export interface IntercomGroup {
  id: string;
  name: string;
  color: string;
  /** Welche User sind aktuell auf dieser Gruppe aktiv (dynamisch, nicht konfiguriert) */
  activeMemberUserIds: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Temporärer Kanal — wird automatisch geöffnet wenn ein User einen Direktruf
 * einleitet und der Empfänger den Sender nicht in seiner Konfiguration hat.
 * Wird nach Ende des Gesprächs wieder geschlossen.
 */
export interface TemporaryChannel {
  id: string;
  /** User der den Ruf initiiert hat */
  callerUserId: string;
  /** User der den temporären Kanal angezeigt bekommt */
  receiverUserId: string;
  /** Wann der Kanal geöffnet wurde */
  openedAt: number;
  /** Läuft noch? */
  active: boolean;
}

export interface EventItem {
  id: string;
  ts: number;
  type: "register" | "heartbeat" | "talk" | "listen" | "assign" | "matrix" | "config" | "system" | "call" | "transcript";
  message: string;
}

export interface MatrixRoute {
  fromDeviceId: string;
  toDeviceId: string;
  channelId: string;
  enabled: boolean;
}

export interface ConfigRef {
  name: string;
  updatedAt: number;
}

export interface PluginBridgeConfig {
  enabled: boolean;
  protocol: "ws" | "http";
  host: string;
  pluginPaths: string[];
  preset?: string;
  bypass: boolean;
}

/**
 * Ziel-Objekt eines Kanal-Slots: Gruppe, Direktruf zu User oder Systemkanal
 */
export type ChannelSlotTarget =
  | { type: "group"; groupId: string }
  | { type: "direct"; userId: string }
  | { type: "system"; channelId: string };

/**
 * Ein Slot auf einem Beltpack / User-Profil.
 * Entspricht einem der konfigurierbaren Kanal-Slots auf dem Gerät.
 */
export interface ChannelSlot {
  /** 0-basierter Index (0 = erster Slot) */
  index: number;
  /** Was auf diesem Slot liegt — fehlt = unbelegt */
  target?: ChannelSlotTarget;
}

/**
 * User-Profil mit Kanal-Slots — entspricht einem "Preset" in Eyevinn-Terminologie.
 * Definiert welche Gruppen / Systemkanäle / Direktruf-Targets einem User zugewiesen sind.
 */
export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  /** Slot-Konfiguration (typischerweise 8 Slots, 0-basiert) */
  slots: ChannelSlot[];
  /** Optionale Companion-Control-URL für dieses Profil */
  companionUrl?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Aktive Client-Session — entspricht einer "UserSession" in Eyevinn-Terminologie.
 * Wird beim WebSocket-Connect erzeugt und beim Disconnect entfernt.
 */
export interface ClientSession {
  id: string;
  deviceId: string;
  userId?: string;
  profileId?: string;
  connectedAt: number;
  lastSeenAt: number;
  /** Aktiv sprechende / hörende Slot-Indizes */
  activeSlotIds: string[];
  isTalking: boolean;
}

/**
 * Control-Aktionen für den Companion-kompatiblen Control-Endpoint.
 * Ermöglicht externe Steuerung (StreamDeck, Companion, etc.)
 */
export type ControlAction =
  | "ptt_start"
  | "ptt_stop"
  | "mute_input"
  | "mute_output"
  | "set_selected_slot"
  | "volume_up"
  | "volume_down"
  | "direct_call_start"
  | "direct_call_end"
  | "emergency_start"
  | "emergency_stop";

export interface CoreState {
  activeConfig: ConfigRef;
  users: Record<string, IntercomUser>;
  devices: Record<string, BeltpackDevice>;
  antennas: Record<string, DectAntenna>;
  /** Alle konfigurierten Kanäle inkl. der 3 Systemkanäle */
  channels: Record<string, Channel>;
  /** Alle konfigurierten Gruppen */
  groups: Record<string, IntercomGroup>;
  /** Aktive temporäre Kanäle (Direktrufe ohne Konfiguration beim Empfänger) */
  temporaryChannels: TemporaryChannel[];
  /** User-Profile / Presets */
  profiles: Record<string, UserProfile>;
  /** Aktive WebSocket-Client-Sessions */
  sessions: Record<string, ClientSession>;
  matrixRoutes: MatrixRoute[];
  pluginBridge: PluginBridgeConfig;
  /** Gerätepräsenz (online/offline) — dynamisch, nicht in Config gespeichert */
  presence?: Record<string, { online: boolean; lastSeenAt: number }>;
  events: EventItem[];
}

export type ClientMessage =
  | {
      type: "register_device";
      payload: {
        id: string;
        label: string;
        transport: TransportType;
        role?: DeviceRole;
        userId?: string;
        channelIds?: string[];
        connectedAntennaId?: string;
      };
    }
  | {
      type: "register_antenna";
      payload: {
        id: string;
        label: string;
        location: string;
      };
    }
  | {
      type: "heartbeat";
      payload: {
        id: string;
        battery?: Partial<BatteryState>;
        network?: Partial<NetworkState>;
      };
    }
  | {
      type: "set_talk";
      payload: {
        id: string;
        channelId: string;
        active: boolean;
      };
    }
  | {
      type: "set_listen";
      payload: {
        id: string;
        channelIds: string[];
      };
    }
  | {
      type: "assign_channels";
      payload: {
        id: string;
        channelIds: string[];
      };
    }
  | {
      type: "set_transcription_channels";
      payload: {
        id: string;
        channelIds: string[];
      };
    }
  | {
      type: "transcribe_audio";
      payload: {
        id: string;
        channelId: string;
        sampleRate: number;
        audio: string;
      };
    }
  | {
      type: "set_user";
      payload: {
        id: string;
        userId?: string;
      };
    }
  /** Direktruf: initiiert einen temporären Kanal beim Empfänger */
  | {
      type: "direct_call";
      payload: {
        fromDeviceId: string;
        toUserId: string;
      };
    }
  /** Direktruf beenden */
  | {
      type: "direct_call_end";
      payload: {
        tempChannelId: string;
      };
    };

export type ServerMessage =
  | { type: "state"; payload: CoreState }
  | { type: "event"; payload: EventItem }
  | {
      type: "audio_chunk";
      payload: {
        fromDeviceId: string;
        channelId: string;
        sampleRate: number;
        audio: string; // base64 Int16 PCM
      };
    }
  /** Server teilt einem Gerät mit, dass ein temporärer Direktruf-Kanal geöffnet wurde */
  | {
      type: "temp_channel_opened";
      payload: TemporaryChannel;
    }
  /** Server teilt einem Gerät mit, dass ein temporärer Direktruf-Kanal geschlossen wurde */
  | {
      type: "temp_channel_closed";
      payload: { tempChannelId: string };
    };
