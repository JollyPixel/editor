// Import Third-party Dependencies
import { defineConfig } from "vite";

export default defineConfig({
  root: "page",
  base: "./",
  build: {
    outDir: "../dist-page",
    emptyOutDir: true
  }
});
