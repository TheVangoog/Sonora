import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Short commit hash of the build, shown in the footer, so a result can name
// the exact version. Vercel gives it as an env variable; locally ask git.
function buildCommit() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { __SONORA_COMMIT__: JSON.stringify(buildCommit()) },
  // npm run dev: /api goes to the local API (npm run server).
  server: { proxy: { "/api": "http://localhost:3001" } },
  preview: { proxy: { "/api": "http://localhost:3001" } },
  // Keep symlinked paths as they are (needed in a restricted Windows setup).
  resolve: { preserveSymlinks: true },
});
