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
        name: "Vetro Vetting App",
        short_name: "Vetro Vetting",
        description: "Scotland's security workforce, verified — BS7858 and BPSS pre-employment vetting, checked automatically.",
        start_url: "/",
        display: "standalone",
        // Matches --vetro-ink (src/styles/tokens.css) and the dark gradient
        // in index.html/SplashScreen.tsx — this is what Chrome/Android
        // renders as the install splash screen's background, generated
        // automatically from the manifest (no separate asset needed there,
        // unlike iOS — see the apple-touch-startup-image links in
        // index.html). Kept dark so it doesn't flash white/light against
        // the dark native iOS splash and the app's own animated one.
        background_color: "#1F2933",
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
