// Preload der Desktop-Huelle. Reicht dem Fenster genau eine Faehigkeit
// hinueber: das Token der Geraetebibliothek lesen, schreiben, loeschen. Das
// Token selbst verschluesselt der Main-Prozess mit `safeStorage`; das Fenster
// sieht nie mehr als den Klartext, den es ohnehin gerade braucht.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("intercomDesktop", {
	deviceLibraryToken: {
		get: (): Promise<string | null> => ipcRenderer.invoke("device-library-token:get"),
		set: (token: string): Promise<boolean> => ipcRenderer.invoke("device-library-token:set", token),
		clear: (): Promise<void> => ipcRenderer.invoke("device-library-token:clear"),
	},
});
