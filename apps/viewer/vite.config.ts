import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(() => {
  const VITE_PORT = parseInt(process.env.VITE_PORT ?? "55173");
  const EXPRESS_PORT = parseInt(process.env.EXPRESS_PORT ?? "33001");
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: VITE_PORT,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${EXPRESS_PORT}`,
          changeOrigin: true,
        },
      },
    },
  };
});
