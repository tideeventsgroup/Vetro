import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js references Node's `global`, which the
  // browser doesn't have.
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
