// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  Extension,
  type ClientHandle,
  type PeerMetadata,
  type RoomContext
} from "@jolly-pixel/network";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

// CONSTANTS
// Must match examples/scripts/demo-peer-frustum-sync.ts's room id.
const kPeerFrustumDemoRoom = "three:peer-frustum-demo";

/**
 * A room needs a registered Extension to exist at all, even when nothing
 * ever rides its message channel — PeerFrustumSync only uses the base
 * join/presence protocol, which `ServerRoom` handles on its own.
 */
class PresenceOnlyExtension extends Extension {
  readonly id: string;
  readonly name: string;

  constructor(
    id: string
  ) {
    super();
    this.id = id;
    this.name = id;
  }

  onClientConnect(
    _client: ClientHandle,
    _identity: PeerMetadata,
    _context: RoomContext
  ): void {
    // No domain state to initialize — presence alone carries the pose.
  }

  onClientDisconnect(
    _clientId: string,
    _context: RoomContext
  ): void {
    // No domain state to tear down.
  }

  onMessage(
    _clientId: string,
    _payload: unknown,
    _context: RoomContext
  ): void {
    // Never called: PeerFrustumSync never sends a "message" envelope.
  }
}

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
