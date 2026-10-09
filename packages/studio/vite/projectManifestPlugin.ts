// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import type {
  Connect,
  Logger,
  Plugin
} from "vite";

// Import Internal Dependencies
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../src/editors/ProjectManifest.ts";
import type { StudioProject } from "../server/project/StudioProject.ts";

// CONSTANTS
const kManifestPathname = `/${PROJECT_MANIFEST_FILE}`;

export function projectManifestPlugin(
  project: StudioProject
): Plugin {
  const source = JSON.stringify(new ProjectManifest({
    editors: project.editors.descriptors(),
    kinds: project.kinds.descriptors()
  }));

  return {
    name: "studio-project-manifest",
    configureServer(server) {
      server.middlewares.use(manifestMiddleware(source));
      logPackages(project, server.config.logger);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: PROJECT_MANIFEST_FILE,
        source
      });
    }
  };
}

function manifestMiddleware(
  source: string
): Connect.NextHandleFunction {
  return (
    request: IncomingMessage,
    response: ServerResponse,
    next: Connect.NextFunction
  ) => {
    const pathname = URL.parse(
      request.url ?? "/",
      "http://localhost"
    )?.pathname;
    if (
      pathname !== kManifestPathname ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      next();

      return;
    }

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    response.end(request.method === "HEAD" ? undefined : source);
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
