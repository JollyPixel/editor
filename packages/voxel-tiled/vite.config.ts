// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig({
  root: "examples",
  server: {
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: true
    })
  ]
});
