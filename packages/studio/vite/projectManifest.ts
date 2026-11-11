// Import Third-party Dependencies
import type {
  Logger,
  Plugin
} from "vite";
import { PROJECT_MANIFEST_FILE } from "@jolly-pixel/server";
import { ManifestRoute, type StudioProject } from "@jolly-pixel/server/node";

export function projectManifest(
  project: StudioProject
): Plugin {
  const route = new ManifestRoute(project);

  return {
    name: "studio-project-manifest",
    configureServer(server) {
      server.middlewares.use(route.middleware);
      logPackages(project, server.config.logger);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: PROJECT_MANIFEST_FILE,
        source: route.source
      });
    }
  };
}

function logPackages(
  project: StudioProject,
  logger: Pick<Logger, "info">
): void {
  for (const editor of project.editors) {
    const from = editor.page.kind === "source" ? editor.page.html : editor.dist;
    logger.info(`editor "${editor.name}" from ${from}`);
  }
  for (const { name } of project.kinds.packages) {
    logger.info(`kinds "${name}" from ${project.kinds.resolver.locate(name)}`);
  }
}
