// Import Node.js Dependencies
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { PORTS } from "@jolly-pixel/e2e";

export default defineConfig({
  root: "examples",
  resolve: {
    alias: [
      {
        find: /^@jolly-pixel\/lantern$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url))
      },
      {
        find: /^@jolly-pixel\/lantern\/element$/,
        replacement: fileURLToPath(new URL("src/element/index.ts", import.meta.url))
      }
    ]
  },
  server: {
    port: PORTS.lantern,
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
