// Import Third-party Dependencies
import type {
  Logger,
  Plugin
} from "vite";

// Import Internal Dependencies
import { PROJECT_MANIFEST_FILE } from "../shared/ProjectManifest.ts";
import { ManifestRoute } from "../server/editors/ManifestRoute.ts";
import type { StudioProject } from "../server/project/StudioProject.ts";

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
    logger.info(`editor "${editor.name}" from ${editor.dist}`);
  }
  for (const { name } of project.kinds.packages) {
    logger.info(`kinds "${name}" from ${project.kinds.resolver.locate(name)}`);
  }
}
