import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "de";

const EN = {
  // ── App sidebar ────────────────────────────────────────
  appTitle: "Intercom",
  navMonitor: "Monitor",
  navSetup: "Setup",
  tabDeviceStatus: "Devices",
  tabEvents: "Events",
  tabTranscriptsMon: "Transcripts",
  tabChannelsRouting: "Channels & Routing",
  tabDevicesUsers: "Devices & Users",
  tabAudio: "Audio",
  tabSettingsLogs: "Settings & Logs",
  configSave: "Save",
  configSaveAs: "Save as\u2026",
  configOpenWebClient: "Open Web Client",
  configNewOpen: "New / Open\u2026",
  configSaveAsPlaceholder: "Config name",
  configSaveBtn: "Save",
  configCancel: "Cancel",
  configHelpTip: "Open getting started guide",

  // ── Dashboard ──────────────────────────────────────────
  dashTitle: "Dashboard",
  dashDevices: "Devices",
  dashEventLog: "Event Log",
  dashNoDevices: "No devices registered yet.",
  dashOnline: "Online",
  dashOffline: "Offline",
  dashTalking: "Talking",
  dashBattery: "Battery",
  dashSignal: "Signal",
  dashLatency: "Latency",

  // ── Channels ───────────────────────────────────────────
  chTitle: "Channels",
  chAddTitle: "Add channel",
  chNamePlaceholder: "Channel name",
  chAddBtn: "Add",
  chEditBtn: "Edit",
  chDeleteBtn: "Delete",
  chSaveBtn: "Save",
  chCancelBtn: "Cancel",

  // ── Devices ────────────────────────────────────────────
  devTitle: "Devices",
  devNoDevices: "No devices configured.",
  devAddTitle: "Add device",
  devId: "Device ID",
  devName: "Name",
  devTransport: "Transport",
  devAddBtn: "Add",
  devEditBtn: "Edit",
  devDeleteBtn: "Delete",
  devSaveBtn: "Save",
  devCancelBtn: "Cancel",
  devQrTitle: "QR Code",
  devQrHint: "Scan to open web client on this device",

  // ── Users ──────────────────────────────────────────────
  usersTitle: "Users & Rights",
  usersAddTitle: "Add user",
  usersName: "Name",
  usersRole: "Role",
  usersAddBtn: "Add",
  usersEditBtn: "Edit",
  usersDeleteBtn: "Delete",
  usersSaveBtn: "Save",
  usersCancelBtn: "Cancel",
  usersPermissions: "Permissions",
  usersTalkChannels: "Talk channels",
  usersListenChannels: "Listen channels",
  usersCanAllCall: "All call",
  usersCanManage: "Manage devices",
  usersNoUsers: "No users configured yet.",

  // ── Matrix ─────────────────────────────────────────────
  matrixTitle: "Matrix Routing",

  // ── Audio ──────────────────────────────────────────────
  audioTitle: "Audio Settings",
  audioNoDevices: "No devices configured.",
  audioInputGain: "Input gain",
  audioOutputGain: "Output gain",
  audioSidetone: "Sidetone",
  audioNoiseGate: "Noise gate",
  audioLimiter: "Limiter",
  audioSaveBtn: "Save changes",
  audioSaved: "Saved",

  // ── Softclient ─────────────────────────────────────────
  softTitle: "Softclient",
  softMicSection: "Microphone",
  softChannelsSection: "Channels",
  softTranscriptsSection: "Transcripts",
  softPttMomentary: "Momentary",
  softPttLatching: "Latching",
  softPttMode: "PTT mode",
  softVox: "VOX",
  softVoxThreshold: "VOX threshold",
  softMasterVolume: "Master volume",
  softTalkAll: "Talk all",
  softReleaseAll: "Release all",
  softNoTranscripts: "No transcripts yet.",

  // ── Transcripts ────────────────────────────────────────
  transcriptTitle: "Transcripts",

  // ── Start screen ───────────────────────────────────────
  startTitle: "Broadcast Intercom",
  startSubtitle: "Select or create a configuration to begin.",
  startLoad: "Load",
  startNew: "New configuration",
  startNewName: "Config name",
  startCreateBtn: "Create",
  startNoConfigs: "No saved configurations yet.",

  // ── Setup screen (PhoneClient) ─────────────────────────
  setupTitle: "Web Intercom Client",
  setupSubtitle: "Give this device a name and optionally select a user.",
  setupDeviceName: "Device name",
  setupUser: "User",
  setupNoUser: "\u2014 no user \u2014",
  setupNoUsersHint: 'No users configured \u2014 add them in the host interface under "Users & Rights".',
  setupConnecting: "Connecting to server\u2026",
  setupContinue: "Continue \u2192",

  // ── PhoneClient main ───────────────────────────────────
  online: "Online",
  offline: "Offline",
  settings: "Settings",
  enableMic: "Enable microphone",
  retryMic: "Retry microphone access",
  releaseMic: "Release",
  audioInput: "Input",
  audioOutput: "Output",
  audioDefault: "Default",
  systemDefault: "System default",
  unnamedMic: "Unnamed microphone",
  unnamedOutput: "Unnamed output",
  idle: "Idle",
  liveLabel: "Live",
  listen: "Listen",
  activeLabel: "Active",
  userLabel: "User",
  userUnassigned: "unassigned",
  micErrorNoHTTPS: "Microphone access requires HTTPS. Please open this page over a secure connection.",

  // ── PTT Slider ─────────────────────────────────────────
  pttPushToTalk: "Push to Talk",
  pttSlideLock: "\u2192 Slide to lock",
  pttSlideToTalk: "Push to Talk",
  pttLive: "LIVE",
  pttTapToStop: "Tap to stop",
  holdToTalk: "Hold to Talk",
  liveTalk: "LIVE",

  // ── Wizard ─────────────────────────────────────────────
  wizardTitle: "Welcome to Broadcast Intercom",
  wizardStep1Title: "What is this?",
  wizardStep1Body:
    "A browser-based professional intercom system. Use the web client on any phone or tablet to join intercom channels \u2014 no app installation needed.",
  wizardStep2Title: "How to use it",
  wizardStep2Body:
    "Select a channel by tapping it. Slide the PTT bar to talk. Slide to the end and release to lock it on. Tap again to stop.",
  wizardStep3Title: "Microphone & HTTPS",
  wizardStep3Body:
    "Browsers require HTTPS to access the microphone on mobile. If you see a security warning, add the mkcert certificate to your device\u2019s trust store (see README).",
  wizardSkip: "Skip",
  wizardNext: "Next",
  wizardFinish: "Get started",
  wizardReopenTip: "You can reopen this guide anytime with the ? button.",

  // ── Host Settings ──────────────────────────────────────
  settingsTitle: "Settings",
  settingsLanguage: "Interface language",
  settingsLanguageEn: "English",
  settingsLanguageDe: "Deutsch",

  // ── Transcription language ──────────────────────────────
  transcriptLangTitle: "Transcription language",
  transcriptLangHint: "Different languages require different Vosk models. Install the model after selecting.",
  transcriptLangEn: "English",
  transcriptLangDe: "German",
  transcriptInstallBtn: "Install model",
  transcriptInstalling: "Installing…",
  transcriptChatEmpty: "No transcripts yet.",
  transcriptChatPlaceholder: "Awaiting speech…",

  // ── Web client modal ────────────────────────────────────
  wcModalTitle: "Web Client Access",
  wcModalLink: "Link",
  wcModalCopy: "Copy",
  wcModalCopied: "Copied!",
  wcModalNoHost: "Open the host UI via the LAN address (not localhost) to generate a link.",
  wcModalConfigure: "Configure in Setup →",

  // ── VST Plugin Bridge ───────────────────────────────────
  pluginTitle: "VST Plugin Bridge",
  pluginEnabled: "Enable bridge",
  pluginProtocol: "Protocol",
  pluginHost: "Bridge URL",
  pluginPaths: "Plugin paths (one per line)",
  pluginBypass: "Bypass all plugins",
  pluginSave: "Save",
  pluginSaved: "Saved",
};

const DE: typeof EN = {
  appTitle: "Intercom",
  navMonitor: "Monitor",
  navSetup: "Setup",
  tabDeviceStatus: "Ger\u00e4te",
  tabEvents: "Ereignisse",
  tabTranscriptsMon: "Transkripte",
  tabChannelsRouting: "Kan\u00e4le & Routing",
  tabDevicesUsers: "Ger\u00e4te & Nutzer",
  tabAudio: "Audio",
  tabSettingsLogs: "Einstellungen & Logs",
  configSave: "Speichern",
  configSaveAs: "Speichern als\u2026",
  configOpenWebClient: "Webclient \u00f6ffnen",
  configNewOpen: "Neu / \u00d6ffnen\u2026",
  configSaveAsPlaceholder: "Konfigurationsname",
  configSaveBtn: "Speichern",
  configCancel: "Abbrechen",
  configHelpTip: "Einf\u00fchrung \u00f6ffnen",
  dashTitle: "Dashboard",
  dashDevices: "Ger\u00e4te",
  dashEventLog: "Ereignisprotokoll",
  dashNoDevices: "Noch keine Ger\u00e4te registriert.",
  dashOnline: "Online",
  dashOffline: "Offline",
  dashTalking: "Spricht",
  dashBattery: "Akku",
  dashSignal: "Signal",
  dashLatency: "Latenz",
  chTitle: "Kan\u00e4le",
  chAddTitle: "Kanal hinzuf\u00fcgen",
  chNamePlaceholder: "Kanalname",
  chAddBtn: "Hinzuf\u00fcgen",
  chEditBtn: "Bearbeiten",
  chDeleteBtn: "L\u00f6schen",
  chSaveBtn: "Speichern",
  chCancelBtn: "Abbrechen",
  devTitle: "Ger\u00e4te",
  devNoDevices: "Keine Ger\u00e4te konfiguriert.",
  devAddTitle: "Ger\u00e4t hinzuf\u00fcgen",
  devId: "Ger\u00e4te-ID",
  devName: "Name",
  devTransport: "Transport",
  devAddBtn: "Hinzuf\u00fcgen",
  devEditBtn: "Bearbeiten",
  devDeleteBtn: "L\u00f6schen",
  devSaveBtn: "Speichern",
  devCancelBtn: "Abbrechen",
  devQrTitle: "QR-Code",
  devQrHint: "Scannen um Webclient auf diesem Ger\u00e4t zu \u00f6ffnen",
  usersTitle: "Nutzer & Rechte",
  usersAddTitle: "Nutzer hinzuf\u00fcgen",
  usersName: "Name",
  usersRole: "Rolle",
  usersAddBtn: "Hinzuf\u00fcgen",
  usersEditBtn: "Bearbeiten",
  usersDeleteBtn: "L\u00f6schen",
  usersSaveBtn: "Speichern",
  usersCancelBtn: "Abbrechen",
  usersPermissions: "Berechtigungen",
  usersTalkChannels: "Sprechen auf",
  usersListenChannels: "H\u00f6ren auf",
  usersCanAllCall: "All-Call",
  usersCanManage: "Ger\u00e4te verwalten",
  usersNoUsers: "Noch keine Nutzer konfiguriert.",
  matrixTitle: "Matrix-Routing",
  audioTitle: "Audio-Einstellungen",
  audioNoDevices: "Keine Ger\u00e4te konfiguriert.",
  audioInputGain: "Eingangsverst\u00e4rkung",
  audioOutputGain: "Ausgangsverst\u00e4rkung",
  audioSidetone: "Sidetone",
  audioNoiseGate: "Noise Gate",
  audioLimiter: "Limiter",
  audioSaveBtn: "\u00c4nderungen speichern",
  audioSaved: "Gespeichert",
  softTitle: "Softclient",
  softMicSection: "Mikrofon",
  softChannelsSection: "Kan\u00e4le",
  softTranscriptsSection: "Transkripte",
  softPttMomentary: "Momentary",
  softPttLatching: "Rastend",
  softPttMode: "PTT-Modus",
  softVox: "VOX",
  softVoxThreshold: "VOX-Schwellwert",
  softMasterVolume: "Master-Lautst\u00e4rke",
  softTalkAll: "Alle sprechen",
  softReleaseAll: "Alle freigeben",
  softNoTranscripts: "Noch keine Transkripte.",
  transcriptTitle: "Transkripte",
  startTitle: "Broadcast Intercom",
  startSubtitle: "W\u00e4hle eine Konfiguration aus oder erstelle eine neue.",
  startLoad: "Laden",
  startNew: "Neue Konfiguration",
  startNewName: "Konfigurationsname",
  startCreateBtn: "Erstellen",
  startNoConfigs: "Noch keine gespeicherten Konfigurationen.",
  setupTitle: "Web Intercom Client",
  setupSubtitle: "Gib diesem Ger\u00e4t einen Namen und w\u00e4hle optional einen Benutzer aus.",
  setupDeviceName: "Ger\u00e4tename",
  setupUser: "Benutzer",
  setupNoUser: "\u2014 kein Benutzer \u2014",
  setupNoUsersHint: 'Keine Benutzer konfiguriert \u2013 unter \u201eNutzer & Rechte\u201c im Host-Interface hinzuf\u00fcgen.',
  setupConnecting: "Verbinde mit dem Server\u2026",
  setupContinue: "Weiter \u2192",
  online: "Online",
  offline: "Offline",
  settings: "Einstellungen",
  enableMic: "Mikrofon aktivieren",
  retryMic: "Erneut anfordern",
  releaseMic: "Freigeben",
  audioInput: "Eingang",
  audioOutput: "Ausgang",
  audioDefault: "Standard",
  systemDefault: "Systemstandard",
  unnamedMic: "Unbekanntes Mikrofon",
  unnamedOutput: "Unbekannter Ausgang",
  idle: "Frei",
  liveLabel: "Live",
  listen: "Mith\u00f6ren",
  activeLabel: "Aktiv",
  userLabel: "Benutzer",
  userUnassigned: "nicht zugewiesen",
  micErrorNoHTTPS: "Mikrofonzugriff erfordert HTTPS. Bitte \u00f6ffne diese Seite \u00fcber eine sichere Verbindung.",
  pttPushToTalk: "Push to Talk",
  pttSlideLock: "\u2192 Einrasten",
  pttSlideToTalk: "Push to Talk",
  pttLive: "LIVE",
  pttTapToStop: "Tippen zum Stoppen",
  holdToTalk: "Halten zum Sprechen",
  liveTalk: "LIVE",
  wizardTitle: "Willkommen bei Broadcast Intercom",
  wizardStep1Title: "Was ist das?",
  wizardStep1Body: "Ein browserbasiertes professionelles Intercom-System. Nutze den Webclient auf jedem Handy oder Tablet \u2013 keine App-Installation erforderlich.",
  wizardStep2Title: "So funktioniert es",
  wizardStep2Body: "W\u00e4hle einen Kanal durch Antippen. Schiebe die PTT-Leiste zum Sprechen. Ganz durchschieben und loslassen rastet ein. Nochmal tippen zum Beenden.",
  wizardStep3Title: "Mikrofon & HTTPS",
  wizardStep3Body: "Browser ben\u00f6tigen HTTPS f\u00fcr Mikrofonzugriff auf Mobilger\u00e4ten. Bei einer Sicherheitswarnung f\u00fcge das mkcert-Zertifikat zum Truststore hinzu (siehe README).",
  wizardSkip: "\u00dcberspringen",
  wizardNext: "Weiter",
  wizardFinish: "Los geht\u2019s",
  wizardReopenTip: "Du kannst diesen Guide jederzeit mit dem ? Button erneut \u00f6ffnen.",
  settingsTitle: "Einstellungen",
  settingsLanguage: "Sprache",
  settingsLanguageEn: "English",
  settingsLanguageDe: "Deutsch",

  // ── Transcription language ──────────────────────────────
  transcriptLangTitle: "Transkriptionssprache",
  transcriptLangHint: "Verschiedene Sprachen benötigen verschiedene Vosk-Modelle. Nach der Auswahl Modell installieren.",
  transcriptLangEn: "Englisch",
  transcriptLangDe: "Deutsch",
  transcriptInstallBtn: "Modell installieren",
  transcriptInstalling: "Wird installiert…",
  transcriptChatEmpty: "Noch keine Transkripte.",
  transcriptChatPlaceholder: "Warte auf Sprache…",

  // ── Web client modal ────────────────────────────────────
  wcModalTitle: "Webclient-Zugang",
  wcModalLink: "Link",
  wcModalCopy: "Kopieren",
  wcModalCopied: "Kopiert!",
  wcModalNoHost: "Öffne das Host-UI über die LAN-Adresse (nicht localhost), um einen Link zu erzeugen.",
  wcModalConfigure: "In Setup konfigurieren →",

  // ── VST Plugin Bridge ───────────────────────────────────
  pluginTitle: "VST Plugin Bridge",
  pluginEnabled: "Bridge aktivieren",
  pluginProtocol: "Protokoll",
  pluginHost: "Bridge-URL",
  pluginPaths: "Plugin-Pfade (einer pro Zeile)",
  pluginBypass: "Alle Plugins umgehen",
  pluginSave: "Speichern",
  pluginSaved: "Gespeichert",
};

export const strings = { en: EN, de: DE } as const;
export type Strings = typeof EN;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Strings;
}

const LangContext = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: EN });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("uiLang") as Lang | null) ?? "en",
  );

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("uiLang", l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: strings[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
