import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Keep symlinked paths as they are (needed in a restricted Windows setup).
  resolve: { preserveSymlinks: true },
});
