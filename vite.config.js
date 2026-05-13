import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        runtimeCaching: [{
          // API calls must always hit the network — conflict detection relies on real server data
          urlPattern: /^\/api\//,
          handler: "NetworkOnly",
        }],
      },
    }),
  ],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": `http://localhost:${process.env.PORT || 8000}`,
    },
  },
});
