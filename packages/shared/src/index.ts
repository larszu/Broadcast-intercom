export type TransportType = "ethernet" | "dect" | "wifi";
export type DeviceRole = "beltpack" | "deskstation";
export type UserRole = "admin" | "director" | "operator" | "talent";

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

export interface IntercomUser {
  id: string;
  name: string;
  role: UserRole;
  color: string;
  permissions: UserPermissions;
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

export interface CoreState {
  activeConfig: ConfigRef;
  users: Record<string, IntercomUser>;
  devices: Record<string, BeltpackDevice>;
  antennas: Record<string, DectAntenna>;
  channels: Record<string, Channel>;
  matrixRoutes: MatrixRoute[];
  pluginBridge: PluginBridgeConfig;
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
    };
