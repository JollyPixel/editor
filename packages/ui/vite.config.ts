// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  PresenceOnlyExtension,
  Server
} from "@jolly-pixel/network";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/node";
import { PORTS } from "@jolly-pixel/e2e";

const network = new Server();
network.setRoomResolver((roomName) => {
  return {
    extension: new PresenceOnlyExtension(roomName)
  };
});

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    port: PORTS.ui,
    strictPort: true,
    allowedHosts: true
  },
  plugins: [
    createWebSocketNetworkPlugin({ server: network }),
    checker({
      typescript: {
        tsconfigPath: "examples/tsconfig.json"
      }
    })
  ]
});
