// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

// Import Internal Dependencies
import { PORT } from "./test/e2e/constants.ts";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    port: PORT,
    strictPort: true,
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: {
        tsconfigPath: "examples/tsconfig.json"
      }
    })
  ]
});
