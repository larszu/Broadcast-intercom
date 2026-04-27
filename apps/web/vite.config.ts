import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "certs/localhost+4-key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "certs/localhost+4.pem")),
    },
    port: 5174,
    hmr: {
      protocol: "wss",
      host: "localhost",
      clientPort: 5174,
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
