import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // API calls go to a separate origin (api.vetro.co.uk) and always need
      // a live, current response — vetting/licence status is exactly the
      // kind of data that must never be served stale, so this only caches
      // the app shell itself (JS/CSS/fonts), not data.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      manifest: {
        name: "Vetro",
        short_name: "Vetro",
        description: "Scotland's security workforce, verified — SIA licence and BS7858 vetting, checked automatically.",
        start_url: "/",
        display: "standalone",
        background_color: "#F7F8FA",
        theme_color: "#0E7C7B",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // amazon-cognito-identity-js references Node's `global`, which the
  // browser doesn't have.
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
