import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Запросы /api уходят на бэкенд: браузер видит один источник, CORS не нужен
    proxy: {
      "/api": {
        target: "http://localhost:3000",
      },
    },
  },
});