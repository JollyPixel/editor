// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import {
  WorkspaceImportScan,
  containerModuleSource
} from "./WorkspaceImportScan.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kWorkspaceScope = "@jolly-pixel/";
const kPage = "index.html";

export function prebundleWorkspace(): Plugin {
  return {
    name: "jolly-pixel:prebundle-workspace",
    apply: (_config, env) => env.command === "serve" && env.mode === kE2EMode,
    config() {
      return {
        optimizeDeps: {
          force: true
        }
      };
    },
    async configureServer(server) {
      const environment = server.environments.client;
      const scan = new WorkspaceImportScan({
        modules: containerModuleSource(
          environment.pluginContainer
        ),
        scope: kWorkspaceScope
      });
      await scan.scanPage(
        path.posix.join(server.config.root, kPage)
      );

      const { optimizeDeps } = environment.config;
      optimizeDeps.include = [
        ...optimizeDeps.include ?? [],
        ...scan.entries
      ];
    }
  };
}
