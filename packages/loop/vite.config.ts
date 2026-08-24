// Import Node.js Dependencies
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

// CONSTANTS
const kExamplesRoot = fileURLToPath(new URL("./examples", import.meta.url));

function examplePage(
  name: string
): string {
  return fileURLToPath(new URL(`./examples/${name}`, import.meta.url));
}

// https://vitejs.dev/config/
export default defineConfig({
  root: kExamplesRoot,
  server: {
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      input: {
        inspector: examplePage("index.html"),
        lag: examplePage("lag.html"),
        interpolation: examplePage("interpolation.html")
      }
    }
  },
  plugins: [
    checker({
      typescript: true
    })
  ]
});
