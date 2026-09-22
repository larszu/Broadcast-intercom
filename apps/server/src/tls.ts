/**
 * HTTPS fuer die Beltpacks im LAN (#23).
 *
 * Das Problem
 * -----------
 * Auf jedem Geraet ausser dem Server selbst stand:
 *
 *   „Microphone access requires HTTPS. Please open this page over a secure
 *    connection."
 *
 * Das ist keine Einstellung, die man wegklicken kann. Browser geben
 * `getUserMedia` nur in einem *secure context* frei — HTTPS, oder `localhost`.
 * Ein Intercom, dessen Beltpacks Handys im selben WLAN sind, laeuft damit per
 * Bauart in die Sperre: der Server ist unter `http://192.168.x.y:4001`
 * erreichbar, und genau dort verweigert jeder Browser das Mikrofon.
 *
 * Die Loesung, die keine ist
 * -------------------------
 * Ein Zertifikat von Let's Encrypt gibt es fuer eine LAN-Adresse nicht: die
 * Ausstellung setzt einen oeffentlich aufloesbaren Namen voraus, und eine
 * Intercom-Anlage steht im Regiewagen ohne Internet. Bleibt ein selbst
 * ausgestelltes Zertifikat.
 *
 * Was das kostet und was es bringt
 * --------------------------------
 * Der Browser zeigt beim ersten Aufruf eine Warnung, die man bestaetigen muss
 * („Erweitert" → „Weiter zu …"). Danach ist die Seite ein secure context, und
 * das Mikrofon geht. Das ist eine Handreichung beim Aufbau — einmal je Geraet —
 * gegen ein Mikrofon, das sonst auf KEINEM Geraet funktioniert.
 *
 * Das Zertifikat wird beim ersten Start erzeugt und neben den Konfigurationen
 * abgelegt. Es traegt alle LAN-Adressen dieses Rechners als SAN-Eintraege,
 * damit es unter jeder davon gilt; kommt eine Adresse dazu (anderes Netz,
 * zweite Schnittstelle), wird es neu erzeugt. Laufzeit zwei Jahre — laenger
 * als jede Produktion, kuerzer als die Aufmerksamkeitsspanne fuer abgelaufene
 * Zertifikate.
 *
 * HTTP bleibt
 * -----------
 * Der Klartext-Port laeuft weiter. Erstens laeuft der Desktop-Client lokal
 * ueber `localhost` und braucht kein TLS, zweitens ist ein Umschalten, das
 * bestehende Aufbauten bricht, hier keine Verbesserung. Die Startausgabe nennt
 * beide Adressen und sagt dazu, welche das Mikrofon freigibt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import selfsigned from "selfsigned";

export interface TlsMaterial {
	key: string;
	cert: string;
	/** Adressen, fuer die dieses Zertifikat ausgestellt ist. */
	hosts: string[];
	/** Wurde es in diesem Start neu erzeugt? Nur fuer die Ausgabe. */
	neuErzeugt: boolean;
}

/** Zwei Jahre. Siehe Kopf der Datei. */
const GUELTIG_TAGE = 730;
const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Holt Schluessel und Zertifikat — erzeugt sie, wenn noetig.
 *
 * @param verzeichnis Wohin die Dateien gehoeren (neben die Konfigurationen).
 * @param hosts       LAN-Adressen dieses Rechners.
 */
export async function zertifikatBesorgen(verzeichnis: string, hosts: string[]): Promise<TlsMaterial> {
	const keyPfad = path.join(verzeichnis, "intercom-key.pem");
	const certPfad = path.join(verzeichnis, "intercom-cert.pem");
	const hostsPfad = path.join(verzeichnis, "intercom-cert-hosts.json");

	// Alle Namen, unter denen die Anlage erreichbar sein soll.
	const alleHosts = Array.from(new Set(["localhost", "127.0.0.1", ...hosts]));

	if (existsSync(keyPfad) && existsSync(certPfad)) {
		// Ein Zertifikat, das die aktuelle Adresse nicht kennt, ist so gut wie
		// keines: der Browser lehnt es ab, und niemand sieht warum. Deshalb
		// wird beim Adresswechsel neu ausgestellt statt weiterverwendet.
		let bekannt: string[] = [];
		try {
			bekannt = JSON.parse(readFileSync(hostsPfad, "utf8")) as string[];
		} catch {
			bekannt = [];
		}
		const fehlt = alleHosts.filter((h) => !bekannt.includes(h));
		if (fehlt.length === 0) {
			return {
				key: readFileSync(keyPfad, "utf8"),
				cert: readFileSync(certPfad, "utf8"),
				hosts: bekannt,
				neuErzeugt: false,
			};
		}
	}

	mkdirSync(verzeichnis, { recursive: true });

	// SAN-Eintraege: Typ 2 ist ein DNS-Name, Typ 7 eine IP-Adresse. Browser
	// pruefen ausschliesslich die SAN-Liste; ein Common Name allein wird seit
	// Jahren ignoriert. Wer das verwechselt, baut ein Zertifikat, das nirgends
	// gilt, und sucht den Fehler beim Browser.
	const san = alleHosts.map((h) =>
		/^\d+\.\d+\.\d+\.\d+$/.test(h)
			? ({ type: 7 as const, ip: h })
			: ({ type: 2 as const, value: h }),
	);

	const erzeugt = await selfsigned.generate(
		[{ name: "commonName", value: alleHosts[0] ?? "localhost" }],
		{
			notBeforeDate: new Date(),
			notAfterDate: new Date(Date.now() + GUELTIG_TAGE * TAG_MS),
			keySize: 2048,
			algorithm: "sha256",
			extensions: [
				{ name: "basicConstraints", cA: false },
				{
					name: "keyUsage",
					digitalSignature: true,
					keyEncipherment: true,
				},
				{ name: "extKeyUsage", serverAuth: true },
				{ name: "subjectAltName", altNames: san },
			],
		},
	);

	writeFileSync(keyPfad, erzeugt.private, { mode: 0o600 });
	writeFileSync(certPfad, erzeugt.cert, { mode: 0o644 });
	writeFileSync(hostsPfad, JSON.stringify(alleHosts, null, 2), "utf8");

	return { key: erzeugt.private, cert: erzeugt.cert, hosts: alleHosts, neuErzeugt: true };
}
