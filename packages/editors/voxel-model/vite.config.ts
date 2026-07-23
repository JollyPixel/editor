// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig({
  plugins: [
    checker({
      // Enable TypeScript type checking
      typescript: false
    })
  ],
  esbuild: {
    target: "es2024"
  }
});
