// ───────────────────────────────────────────────────────────────────────────
// Die Konfiguration ueberlebt einen Absturz waehrend des Speicherns.
//
// BEFUND (Defektformen-Sweep, Form `zustand-nach-fehler`). `saveConfig`
// schrieb mit einem blanken `fs.writeFile` direkt auf die Zieldatei. Faellt
// der Rechner dabei aus — Strom weg, Deckel zu, `kill` beim Herunterfahren —,
// steht dort eine halbe Datei. Beim naechsten Start wirft `JSON.parse`, und
// `initializeState` hatte dafuer keinen Zweig: der Kern startete nicht mehr.
//
// Das ist kein theoretischer Fall. Gespeichert wird bei jeder
// Konfigurationsaenderung und bei jedem uebernommenen Intercom-Plan, also
// waehrend des Aufbaus — genau dann, wenn Laptops zugeklappt und Steckdosen
// umgesteckt werden. Und es trifft die Datei, in der das ganze System steht:
// Geraete, Kanaele, Rechte, Matrix.
//
// DIE REGEL IST NICHT NEU. Der Cable-Planner der Suite fuehrt sie als
// nicht-verhandelbare Invariante: „Schreibvorgaenge fuer Userdaten immer
// atomic (tmp -> .bak-Rotation -> rename). Niemals direkt fs.writeFile."
// Hier fehlte sie.
//
// WIE ES JETZT LAEUFT:
//
//   1. In `<name>.json.tmp` schreiben und die Daten auf die Platte zwingen
//      (`fsync`). Ohne das kann `rename` fertig sein, waehrend der Inhalt
//      noch im Cache steht — dann zeigt der Name auf eine leere Datei.
//   2. Die vorhandene Datei nach `<name>.json.bak` drehen.
//   3. `rename` der tmp-Datei auf das Ziel. `rename` ist im selben Verzeichnis
//      atomar: es gibt keinen Moment, in dem die Zieldatei halb ist.
//
// Und beim Lesen: ist die Hauptdatei unlesbar, wird die `.bak` genommen und
// das GEMELDET. Was NICHT passiert, ist ein sofortiges Ueberschreiben der
// kaputten Datei — das wuerde den Beleg vernichten, den jemand vielleicht
// noch von Hand retten kann.
// ───────────────────────────────────────────────────────────────────────────
import { promises as fs } from "node:fs";
import path from "node:path";

/** Woher der gelesene Stand kam — der Aufrufer soll es sagen koennen. */
export type LoadSource = "haupt" | "sicherung";

export interface LoadResult<T> {
	value: T;
	source: LoadSource;
	/** Gesetzt, wenn die Hauptdatei unlesbar war. Gehoert ins Ereignisprotokoll. */
	warnung?: string;
}

export const tmpPath = (target: string): string => `${target}.tmp`;
export const bakPath = (target: string): string => `${target}.bak`;

/**
 * Text atomar schreiben: tmp -> fsync -> .bak-Rotation -> rename.
 *
 * `fsync` auf der tmp-Datei und danach auf dem VERZEICHNIS: das zweite sorgt
 * dafuer, dass auch der Verzeichniseintrag des `rename` auf der Platte steht.
 * Ohne beides ist „atomar" nur im Speicher wahr.
 */
export async function atomicWrite(target: string, text: string): Promise<void> {
	const tmp = tmpPath(target);
	const handle = await fs.open(tmp, "w");
	try {
		await handle.writeFile(text, "utf-8");
		await handle.sync();
	} finally {
		await handle.close();
	}

	// Rotation: die bisherige Fassung bleibt als .bak erhalten. Fehlt sie noch
	// (erster Schreibvorgang), ist das kein Fehler.
	try {
		await fs.rename(target, bakPath(target));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}

	await fs.rename(tmp, target);

	try {
		const dir = await fs.open(path.dirname(target), "r");
		try {
			await dir.sync();
		} finally {
			await dir.close();
		}
	} catch {
		// Auf manchen Dateisystemen (und unter Windows) laesst sich ein
		// Verzeichnis nicht oeffnen oder syncen. Der `rename` selbst ist
		// trotzdem atomar; nur die Haltbarkeit ueber einen Stromausfall
		// hinweg ist dann schwaecher. Kein Grund, den Schreibvorgang
		// scheitern zu lassen.
	}
}

/**
 * Lesen mit Rueckfall auf die Sicherung.
 *
 * `parse` darf werfen — genau dafuer ist der Rueckfall da. Wirft auch die
 * Sicherung (oder fehlt sie), wirft diese Funktion, und der Aufrufer
 * entscheidet, was ein leerer Anfang kostet.
 */
export async function readWithBackup<T>(
	target: string,
	parse: (raw: string) => T,
): Promise<LoadResult<T>> {
	try {
		return { value: parse(await fs.readFile(target, "utf-8")), source: "haupt" };
	} catch (hauptFehler) {
		try {
			const value = parse(await fs.readFile(bakPath(target), "utf-8"));
			return {
				value,
				source: "sicherung",
				warnung:
					`${path.basename(target)} ist unlesbar (${beschreibe(hauptFehler)}) — ` +
					`die Sicherung ${path.basename(bakPath(target))} wurde geladen. ` +
					`Die kaputte Datei bleibt liegen und wird nicht ueberschrieben.`,
			};
		} catch {
			throw hauptFehler;
		}
	}
}

const beschreibe = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
