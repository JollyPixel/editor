// Import Node.js Dependencies
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  PresenceOnlyExtension
} from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

// Import Internal Dependencies
import {
  PEER_FRUSTUM_ROOM,
  PEER_SELECTION_ROOM
} from "./examples/shared/rooms.ts";

// CONSTANTS
const kExamplesRoot = fileURLToPath(
  new URL("examples", import.meta.url)
);
const kPages = globSync("**/index.html", {
  cwd: kExamplesRoot,
  exclude: (entry) => entry === "dist"
}).map((page) => page.replaceAll("\\", "/"));

export default defineConfig({
  root: "examples",
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        kPages.map((page) => [
          page.replace(/[/]?index\.html$/, "") || "index",
          fileURLToPath(new URL(`examples/${page}`, import.meta.url))
        ])
      )
    }
  },
  server: {
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: {
        tsconfigPath: "examples/tsconfig.json"
      }
    }),
    createWebSocketNetworkPlugin({
      extensions: [
        new PresenceOnlyExtension(PEER_FRUSTUM_ROOM),
        new PresenceOnlyExtension(PEER_SELECTION_ROOM)
      ]
    })
  ]
});
