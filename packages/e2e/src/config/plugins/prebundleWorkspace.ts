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
const kPageExtension = ".html";
const kGlobPattern = /[*?[\]{}!]/;

export function prebundleWorkspace(): Plugin {
  let pages: string[] = [];

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
    configResolved(config) {
      pages = scannedPages(config.optimizeDeps.entries);
    },
    async configureServer(server) {
      const environment = server.environments.client;
      const scan = new WorkspaceImportScan({
        modules: containerModuleSource(
          environment.pluginContainer
        ),
        scope: kWorkspaceScope
      });
      const { optimizeDeps } = environment.config;
      for (const page of pages) {
        await scan.scanPage(
          path.posix.join(server.config.root, page)
        );
      }

      optimizeDeps.include = [
        ...optimizeDeps.include ?? [],
        ...scan.entries
      ];
    }
  };
}

function scannedPages(
  entries: string | string[] | undefined
): string[] {
  if (entries === undefined) {
    return [kPage];
  }

  return [entries].flat().filter((entry) => {
    if (kGlobPattern.test(entry)) {
      throw new TypeError(
        `optimizeDeps.entries "${entry}" is a glob: list each page path.`
      );
    }

    return entry.endsWith(kPageExtension);
  });
}
