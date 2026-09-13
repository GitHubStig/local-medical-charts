import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // The app imports shared code from desktop/ and sample reports from samples/.
    fs: { allow: [".."] },
  },
  build: {
    // The desktop app serves this folder; nothing is fetched from a CDN.
    outDir: "dist",
    emptyOutDir: true,
    // The Vega-Lite chart backend is ~1.1 MB, split into its own chunk and only
    // loaded when a chart first draws; the main bundle stays small.
    chunkSizeWarningLimit: 1200,
  },
});
