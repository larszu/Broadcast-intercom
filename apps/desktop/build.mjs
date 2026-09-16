// Baut die beiden JS-Buendel der Desktop-Huelle mit esbuild:
//
//   dist/main.cjs    — der Electron-Main-Prozess (src/main.ts)
//   dist/server.cjs  — der Intercom-Kern (apps/server/src/index.ts), inklusive
//                      @broadcast/shared, express, ws, cors, adm-zip in EINER
//                      Datei
//
// Warum buendeln statt node_modules mitliefern: der Kern ist ein
// Workspace-Paket, dessen Abhaengigkeiten ins Wurzel-node_modules gehoisted
// werden. Was genau dort landet, haengt von der npm-Version ab — electron-
// builder eine verlaessliche Dateiliste zu geben ist damit fragil. Ein einziges
// gebuendeltes .cjs ist reproduzierbar und braucht zur Laufzeit keine
// node_modules. Es liegt als extraResource neben dem asar (siehe
// electron-builder.js), weil ein Kindprozess nicht aus dem asar geforkt wird.
import { build } from "esbuild";
import { rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const serverEntry = path.join(here, "..", "server", "src", "index.ts");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
	bundle: true,
	platform: "node",
	// Electron 33 bringt Node 20 mit; der Kern und der Main-Prozess laufen beide
	// in diesem Node.
	target: "node20",
	format: "cjs",
	outExtension: { ".js": ".cjs" },
	logLevel: "info",
};

// Main-Prozess. `electron` ist zur Laufzeit vorhanden und darf NICHT gebuendelt
// werden.
await build({
	...common,
	entryPoints: { main: path.join(here, "src", "main.ts") },
	outdir: dist,
	external: ["electron"],
});

// Intercom-Kern. `vosk` ist eine optionale native Abhaengigkeit (Spracherkennung)
// und wird per createRequire zur Laufzeit geladen — der Kern faengt ihr Fehlen
// bereits ab. `bufferutil`/`utf-8-validate` sind optionale native Beschleuniger
// von `ws`, ebenfalls guarded. Alle drei bleiben extern, damit esbuild nicht an
// nativem Code scheitert; fehlen sie zur Laufzeit, laeuft der Kern ohne sie.
//
// Der Kern ist ESM und nutzt `import.meta.url` (fuer __dirname und
// createRequire). Im CJS-Bundle waere `import.meta.url` leer -> fileURLToPath
// wuerfe beim Start. Deshalb wird es auf eine aus `__filename` berechnete
// file://-URL umdefiniert; `__filename`/`require` liefert die CJS-Ausgabe
// nativ. So laeuft server.cjs als forkbares CJS und die __dirname-Ableitung
// bleibt gueltig (im gepackten Betrieb ueberschreiben ohnehin die Env-Variablen
// WEB_DIST/INTERCOM_DATA_DIR die abgeleiteten Pfade).
await build({
	...common,
	entryPoints: { server: serverEntry },
	outdir: dist,
	external: ["vosk", "bufferutil", "utf-8-validate"],
	define: { "import.meta.url": "__importMetaUrl" },
	banner: { js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
});

console.log("desktop: main.cjs + server.cjs gebaut ->", dist);
