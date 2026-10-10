// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import {
  CookieRoles,
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  createPixelArtSeed,
  TEXTURE_SIZE
} from "./page/scripts/pixelArtProject.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTextureAssetId = "texture-default";
const kCatalogMaxContentBytes = 32 * 1024 * 1024;
const kRights = {
  member: {
    "*": "write"
  },
  spectator: {
    "*.$join": "write",
    "*.$presence": "write",
    "*": "read"
  }
} as const;

const kRoles = new CookieRoles();
const kinds = await ProjectKinds.load(
  new ProjectFile(import.meta.dirname, {
    version: 1,
    kinds: {
      "@jolly-pixel/asset.pixel-art": {
        defaultSize: TEXTURE_SIZE
      }
    }
  })
);

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const e2e = mode === kE2EMode;
  const serve = command === "serve";

  return {
    root: "page",
    base: "./",
    build: {
      outDir: "../dist-page",
      emptyOutDir: true
    },
    server: {
      port: PORTS.pixelArt,
      strictPort: true,
      allowedHosts: true
    },
    plugins: [
      prebundleWorkspace(),
      serve && !e2e ? checker({ typescript: true }) : null,
      createProjectKindsPlugin(kinds),
      e2e ? kRoles.plugin() : null,
      serve ?
        createAssetWorkspacePlugin({
          root: import.meta.dirname,
          source: new MemoryAssetSource(),
          eventStore: EventStore.persistence.memory(),
          handlers: kinds.handlers(),
          seed: createPixelArtSeed(kTextureAssetId),
          launch: () => kTextureAssetId,
          auth: e2e ? kRoles : undefined,
          rights: kRights,
          defaultRole: "member",
          backend: {
            catalogMaxContentBytes: kCatalogMaxContentBytes
          }
        }) :
        null
    ]
  };
});
