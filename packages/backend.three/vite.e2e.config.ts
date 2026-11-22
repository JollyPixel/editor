// Import Third-party Dependencies
import { defineConfig } from "vite";
import { PORTS } from "@jolly-pixel/e2e";

export default defineConfig({
  root: "test/e2e/app",
  server: {
    port: PORTS.runtime,
    strictPort: true
  }
});
