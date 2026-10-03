// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import type { ProjectFile } from "../project/ProjectFile.ts";

export function createProjectFileWatchPlugin(
  file: ProjectFile
): Plugin {
  const filePath = path.resolve(file.path);

  return {
    name: "asset-server-project-file-watch",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(filePath);
      server.watcher.on("change", async(changed) => {
        if (path.resolve(changed) !== filePath || !await file.isStale()) {
          return;
        }

        server.config.logger.info(
          `${filePath} changed, restarting the server.`
        );
        await server.restart();
      });
    }
  };
}
