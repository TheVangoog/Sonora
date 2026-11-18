import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // npm run dev: /api goes to the local API (npm run server).
  server: { proxy: { "/api": "http://localhost:3001" } },
  preview: { proxy: { "/api": "http://localhost:3001" } },
  // Keep symlinked paths as they are (needed in a restricted Windows setup).
  resolve: { preserveSymlinks: true },
});
