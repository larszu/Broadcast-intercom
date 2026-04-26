# Broadcast Intercom

Prototyp eines browser-basierten Intercom-Systems, inspiriert von Green-GO / Riedel Bolero.  
Unterstützt DECT- und PoE-Beltpacks sowie Web-Clients (Smartphone/Browser).

---

## Voraussetzungen

| Tool | Version | Installieren |
|------|---------|-------------|
| Node.js | 20 LTS (via fnm) | `winget install Schniz.fnm` |
| npm | ≥ 10 | kommt mit Node |
| mkcert | ≥ 1.4 | `winget install FiloSottile.mkcert` |

---

## Ersteinrichtung (einmalig)

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone https://github.com/larszu/Broadcast-intercom.git
cd "Broadcast-intercom"
npm install
```

### 2. Node 20 als Standard setzen

```powershell
fnm install 20
fnm default 20
```

### 3. HTTPS-Zertifikat erstellen (vertrauenswürdig, kein Browser-Warning)

```powershell
# PATH aktualisieren (neues Terminal oder nach winget-Install)
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Root-CA ins System-Truststore installieren (einmalig, braucht UAC)
mkcert -install

# Zertifikat für lokale IPs erzeugen – eigene LAN-IPs anpassen!
cd apps/web
New-Item -ItemType Directory -Force -Path certs | Out-Null
cd certs
mkcert localhost 127.0.0.1 <deine-LAN-IP> ::1
cd ../../..
```

> **Hinweis:** Die Zertifikatsdateien liegen in `apps/web/certs/` und sind via `.gitignore` ausgeschlossen.  
> Nach einem `git clone` auf einem neuen Rechner muss Schritt 3 wiederholt werden.

#### Mobile Geräte (iOS / Android)

Damit das Schloss-Symbol auch auf Smartphones erscheint:
1. Root-CA-Datei kopieren: `%LOCALAPPDATA%\mkcert\rootCA.pem`
2. Per AirDrop / E-Mail auf das Gerät übertragen
3. **iOS:** *Einstellungen → Allgemein → VPN & Geräteverwaltung → installieren*  
   Dann: *Einstellungen → Allgemein → Info → Zertifikatvertrauenseinstellungen → aktivieren*
4. **Android:** *Einstellungen → Sicherheit → Zertifikate installieren*

---

## Server starten

### Mit Mock-Geräten (für Entwicklung / Demo)

```bash
npm run dev:mock
```

Startet:
- **Backend** auf `http://localhost:4000` (Express + WebSocket, simulierte Beltpacks)
- **Frontend** auf `https://localhost:5173` (Vite, Hot-Reload)

### Ohne Mock-Geräte (Echtbetrieb)

```bash
npm run dev
```

### Nur Backend / nur Frontend

```bash
npm run dev:server   # nur Server auf :4000
npm run dev:web      # nur Vite auf :5173
```

> **Port-Konflikt?** `npm run dev:mock` räumt die Ports 4000, 5173 und 5174 automatisch frei (`npm run kill-ports`).

---

## URLs

| Interface | URL |
|-----------|-----|
| Host-Dashboard | `https://localhost:5173/` |
| Web-Client (Smartphone) | `https://<LAN-IP>:5173/?mode=client` |
| Web-Client mit festem User | `https://<LAN-IP>:5173/?mode=client&userId=<id>` |
| QR-Code-Provisioning | Im Host-Dashboard unter *Devices* |

### Erster Start des Web-Clients

Beim ersten Öffnen von `?mode=client` erscheint ein **Setup-Screen**:
- **Gerätename** eingeben (z. B. `Reporter Bühne 1`)
- Optional einen **Benutzer** aus der Liste auswählen
- Mit **Weiter →** bestätigen

Name und User werden in `localStorage` gespeichert — beim nächsten Öffnen wird der Setup-Screen übersprungen.  
Über das ⚙-Symbol oben rechts kann die Einrichtung jederzeit erneut geöffnet werden.

---

## Build (Produktion)

```bash
npm run build
```

Erzeugt kompilierte Ausgabe in `apps/server/dist/` und `apps/web/dist/`.

---

## Projektstruktur

```
apps/
  server/          Express + WebSocket Backend (TypeScript, tsx)
    src/index.ts   Haupt-Einstiegspunkt: Devices, Users, Channels, Vosk
  web/             React + Vite Frontend
    src/
      views/
        HostDashboard.tsx   Host-Interface (Geräteverwaltung, Kanäle, Logs)
        PhoneClient.tsx     Mobiler Web-Client (PTT, Kanäle, Mic-Meter)
      hooks/
        useIntercomStore.ts WebSocket-State-Management
    certs/          mkcert-Zertifikate (gitignore'd)
packages/
  shared/          Gemeinsame TypeScript-Typen (CoreState, IntercomUser, …)
```

---

## Bekannte Einschränkungen

- **Vosk-Transkription** benötigt ein lokal heruntergeladenes Sprachmodell unter `apps/server/models/`.  
  Ohne Modell läuft der Server trotzdem — Transkription ist einfach deaktiviert.
- **HTTPS ist Pflicht** für `getUserMedia` (Mikrofon) in modernen Browsern, auch im LAN.
- **HMR auf Mobilgeräten** ist deaktiviert (`hmr.host: "localhost"`) — Vite-Neuladen von Dateien  
  während der Entwicklung betrifft nur den lokalen Browser, nicht angeschlossene Smartphones.

