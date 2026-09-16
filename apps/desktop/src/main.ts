// Electron-Main-Prozess der Desktop-Huelle.
//
// Broadcast Intercom ist im Kern ein Server (Express + WS), gegen den sich
// Beltpacks und Telefon-Clients im LAN verbinden, plus ein Web-UI, das der
// Operator bedient. Die Desktop-App aendert daran NICHTS an der Architektur:
// dieser Main-Prozess startet denselben Kern (gebuendelt als `server.cjs`) als
// Kindprozess und oeffnet ein Fenster, das die vom Kern ausgelieferte UI unter
// http://localhost:<port> laedt. Die UI baut alle URLs aus location.origin,
// deshalb MUSS sie ueber HTTP von derselben Origin wie die API kommen — ein
// `file://`-Fenster wuerde /api und /ws ins Leere laufen lassen. Andere Geraete
// im selben Netz erreichen denselben Kern weiterhin ueber die LAN-Adresse.
import { app, BrowserWindow, shell, utilityProcess, type UtilityProcess } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";

const PORT = Number(process.env.PORT || 4001);
const STARTUP_URL = `http://localhost:${PORT}`;
const READY_URL = `${STARTUP_URL}/api/state`;

// Pfade unterscheiden sich zwischen "unverpackt gestartet" (electron .) und
// dem gepackten Build. Im gepackten Build liegen `server.cjs` und das Web-UI
// als extraResources neben dem asar (process.resourcesPath), weil ein
// Kindprozess nicht aus dem read-only asar geforkt werden kann und das UI
// beschreibbar/lesbar auf der Platte liegen muss.
const serverEntry = app.isPackaged
	? path.join(process.resourcesPath, "server.cjs")
	: path.join(__dirname, "server.cjs");
const webDist = app.isPackaged
	? path.join(process.resourcesPath, "web")
	: path.join(__dirname, "..", "..", "web", "dist");
// Beschreibbares Datenverzeichnis. Das gepackte asar ist read-only, also
// gehoeren configs/ und models/ in den userData-Pfad des Betriebssystems.
const dataDir = path.join(app.getPath("userData"), "data");

let serverProc: UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function startServer(): void {
	if (!existsSync(serverEntry)) {
		throw new Error(`Server-Bundle nicht gefunden: ${serverEntry} — wurde "npm run build" ausgefuehrt?`);
	}
	// utilityProcess ist Electrons empfohlener Weg, Node-Code als Kindprozess zu
	// fahren: er laeuft in einem echten Node-Kontext (nicht im Renderer) und
	// wird beim App-Ende sauber mitbeendet.
	serverProc = utilityProcess.fork(serverEntry, [], {
		stdio: "inherit",
		env: {
			...process.env,
			PORT: String(PORT),
			INTERCOM_DATA_DIR: dataDir,
			WEB_DIST: webDist,
			NODE_ENV: "production",
		},
	});
	serverProc.on("exit", (code) => {
		serverProc = null;
		// Stirbt der Kern, ist das Fenster nutzlos — die App beenden statt eine
		// leere Seite stehen zu lassen.
		if (code !== 0 && !app.isPackaged) {
			console.error(`Intercom-Kern beendet mit Code ${code}`);
		}
		if (mainWindow && !mainWindow.isDestroyed()) {
			app.quit();
		}
	});
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	// Erst warten, wenn der Kern die API bedient — sonst laedt das Fenster ins
	// Leere und der Nutzer sieht einen Verbindungsfehler statt der UI.
	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (res.ok) return;
		} catch {
			// noch nicht bereit
		}
		if (Date.now() > deadline) {
			throw new Error(`Intercom-Kern wurde unter ${url} nicht bereit (${timeoutMs} ms).`);
		}
		await new Promise((r) => setTimeout(r, 300));
	}
}

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 960,
		minHeight: 600,
		backgroundColor: "#0b0f14",
		title: "Broadcast Intercom",
		autoHideMenuBar: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	// Links mit target=_blank (z. B. "Open Web Client") im System-Browser oeffnen,
	// nicht in einem randlosen Electron-Fenster.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	mainWindow.loadURL(STARTUP_URL);
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

app.whenReady().then(async () => {
	startServer();
	try {
		await waitForServer(READY_URL, 30000);
	} catch (error) {
		console.error(error);
	}
	createWindow();

	app.on("activate", () => {
		// macOS: Klick aufs Dock-Icon ohne offene Fenster oeffnet wieder eines.
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	// Auf allen Plattformen beenden — der Kern soll nicht ohne Fenster
	// weiterlaufen (er haelt sonst den Port und laeuft im Hintergrund weiter).
	app.quit();
});

app.on("before-quit", () => {
	if (serverProc) {
		serverProc.kill();
		serverProc = null;
	}
});
