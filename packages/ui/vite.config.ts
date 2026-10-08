// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  PresenceOnlyExtension,
  Server
} from "@jolly-pixel/network";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/node";
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// CONSTANTS
const kE2EMode = "e2e";

const network = new Server();
network.setRoomResolver((roomName) => {
  return {
    extension: new PresenceOnlyExtension(roomName)
  };
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const e2e = mode === kE2EMode;

  return {
    root: "examples",
    server: {
      port: PORTS.ui,
      strictPort: true
    },
    preview: {
      port: PORTS.ui,
      strictPort: true
    },
    build: {
      rolldownOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    },
    plugins: [
      prebundleWorkspace(),
      createWebSocketNetworkPlugin({ server: network }),
      e2e ?
        null :
        checker({
          typescript: {
            tsconfigPath: "examples/tsconfig.json"
          }
        })
    ]
  };
});
