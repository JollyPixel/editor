// Import Node.js Dependencies
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { PORTS } from "@jolly-pixel/e2e";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  resolve: {
    alias: [
      {
        find: /^@jolly-pixel\/console$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url))
      },
      {
        find: /^@jolly-pixel\/console\/element$/,
        replacement: fileURLToPath(new URL("src/element/index.ts", import.meta.url))
      }
    ]
  },
  server: {
    port: PORTS.console,
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
