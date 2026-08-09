import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    // Deep-link / SPA fallback: all 404s return index.html so React Router handles them
    historyApiFallback: true,
  },
  preview: {
    // Also enable for `vite preview`
    historyApiFallback: true,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
