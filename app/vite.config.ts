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
    // Each chart library is its own chunk, loaded only when it's chosen; the
    // largest (Plotly, ~1.4 MB) sets the limit. The main bundle stays small.
    chunkSizeWarningLimit: 1500,
  },
});
