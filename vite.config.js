import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * GitHub Pages serves this project from /Waste-Management/, so the built asset
 * URLs need that prefix. Locally the base stays "/" — set GITHUB_PAGES=true (the
 * deploy workflow does) to build for Pages.
 */
const forPages = process.env.GITHUB_PAGES === "true";

/**
 * GitHub Pages has no server-side routing: opening /Waste-Management/dashboard
 * directly asks Pages for a file that does not exist, and it answers with
 * 404.html. Shipping a copy of index.html under that name hands the URL back to
 * the router instead of showing a Pages 404.
 */
function spaFallback() {
  return {
    name: "spa-404-fallback",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
    },
  };
}

export default defineConfig({
  base: forPages ? "/Waste-Management/" : "/",
  plugins: [react(), spaFallback()],
  build: {
    outDir: "dist",
    // The export libraries are loaded on demand, so the warning is expected.
    chunkSizeWarningLimit: 1200,
  },
});
