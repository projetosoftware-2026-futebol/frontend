import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const gatewayTarget = process.env.VITE_GATEWAY_URL ?? "http://localhost:80";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/clube": gatewayTarget,
      "/jogador": gatewayTarget,
      "/jogos": gatewayTarget,
    },
  },
});
