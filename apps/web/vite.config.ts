import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTTPS is only enabled when locally-generated mkcert certificates are present.
// In headless / CI environments (or any machine without the certs) we fall back
// to plain HTTP so the dev server and `vite build` still work.
const keyPath = path.resolve(__dirname, "certs/localhost+4-key.pem");
const certPath = path.resolve(__dirname, "certs/localhost+4.pem");
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

const httpsConfig = hasCerts
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: httpsConfig,
    port: 5200,
    hmr: {
      protocol: hasCerts ? "wss" : "ws",
      host: "localhost",
      clientPort: 5200,
    },
    proxy: {
      "/api": "http://localhost:4001",
      "/ws": {
        target: "ws://localhost:4001",
        ws: true,
      },
    },
  },
});
