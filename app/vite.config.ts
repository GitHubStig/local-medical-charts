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
  },
});
