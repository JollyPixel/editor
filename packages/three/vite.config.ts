// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  PresenceOnlyExtension
} from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

// CONSTANTS
// Must match examples/scripts/demo-peer-frustum-sync.ts's room id.
const kPeerFrustumDemoRoom = "three:peer-frustum-demo";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  plugins: [
    checker({ typescript: true }),
    createWebSocketNetworkPlugin({
      extensions: [
        new PresenceOnlyExtension(kPeerFrustumDemoRoom)
      ]
    })
  ]
});
