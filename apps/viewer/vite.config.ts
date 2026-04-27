import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT ?? "55173"),
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.EXPRESS_PORT ?? "33001"}`,
        changeOrigin: true,
      },
    },
  },
});
