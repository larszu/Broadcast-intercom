// electron-builder-Konfiguration der Desktop-Huelle. Erzeugt .exe (Windows) und
// .dmg + .zip (macOS) plus die Auto-Update-Manifeste — dieselbe Gattung
// Artefakte wie beim Cable Planner.
//
// Kein bezahltes Signing-Zertifikat vorhanden: macOS wird ad-hoc signiert
// (identity '-'), damit Gatekeeper auf Apple Silicon die Binary ueberhaupt
// annimmt; Windows bleibt unsigniert (SmartScreen zeigt "Unbekannter
// Herausgeber", bis ein CA-Zertifikat via CSC_LINK hinterlegt ist).
const year = new Date().getFullYear();

module.exports = {
	appId: "net.broadcastintercom.app",
	productName: "Broadcast Intercom",
	copyright: `Copyright © ${year} Lars Zumpe`,
	// Auto-Update-Quelle. electron-builder bettet daraus die app-update.yml ins
	// Paket ein; die release.yml haengt latest*.yml + Blockmaps ans Release, der
	// eingebaute Updater findet sie dort.
	publish: [{ provider: "github", owner: "larszu", repo: "Broadcast-intercom", releaseType: "release" }],
	// Nur der Main-Prozess kommt ins asar. Der Kern (server.cjs) und das Web-UI
	// liegen als extraResources daneben (siehe unten) — der Kern, weil ein
	// Kindprozess nicht aus dem asar geforkt werden kann; das UI, weil es der
	// Kern von der Platte ausliefert.
	files: ["dist/main.cjs", "dist/preload.cjs", "package.json"],
	extraResources: [
		{ from: "dist/server.cjs", to: "server.cjs" },
		{ from: "../web/dist", to: "web" },
	],
	// Kein natives Modul im Paket (der Kern ist ein einzelnes gebuendeltes .cjs,
	// vosk bleibt extern), also nichts zu rebuilden. Das spart auf jedem
	// Runner den Electron-Rebuild und haelt den Universal-Merge trivial:
	// beide Arch-asars sind byte-gleich, es bleibt bei EINEM app.asar.
	npmRebuild: false,
	directories: {
		buildResources: "build",
		output: "release",
	},
	mac: {
		category: "public.app-category.utilities",
		// Universal-Build (arm64 + x64 in einer .app): nativ auf Apple Silicon,
		// weiterhin auf Intel. dmg = Download; zip = was der Auto-Updater braucht
		// (Squirrel.Mac spielt Updates nur aus einem zip ein, latest-mac.yml
		// zeigt darauf).
		target: [
			{ target: "dmg", arch: "universal" },
			{ target: "zip", arch: "universal" },
		],
		artifactName: "${productName}-${version}-${arch}.${ext}",
		icon: "build/icon.png",
		// Ad-hoc-Signatur: arm64-macOS laedt vollstaendig unsignierte Binaries
		// nicht, die Platzhalter-Signatur "-" genuegt der OS-Pruefung. Der Nutzer
		// sieht beim ersten Start weiter den "unbekannter Entwickler"-Dialog und
		// oeffnet per Rechtsklick -> Oeffnen (kein Apple-Developer-ID noetig).
		identity: "-",
		hardenedRuntime: false,
		gatekeeperAssess: false,
	},
	win: {
		target: [
			{ target: "nsis", arch: "x64" },
			{ target: "portable", arch: "x64" },
		],
		artifactName: "${productName}-${version}-${arch}.${ext}",
		icon: "build/icon.ico",
	},
	nsis: {
		oneClick: false,
		allowToChangeInstallationDirectory: true,
		perMachine: false,
		shortcutName: "Broadcast Intercom",
		createDesktopShortcut: true,
		createStartMenuShortcut: true,
	},
	portable: {
		artifactName: "${productName}-${version}-portable.${ext}",
	},
};
