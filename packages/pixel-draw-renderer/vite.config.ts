// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  plugins: [
    checker({
      typescript: true
    })
  ]
});

