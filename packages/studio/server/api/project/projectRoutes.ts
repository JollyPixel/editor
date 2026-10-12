// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ProjectController } from "./ProjectController.ts";
import { PROJECT_ARCHIVE_PATH } from "../../../src/project/routes.ts";
import type { ProjectArchive } from "../../project/ProjectArchive.ts";

export interface ProjectRoutesOptions {
  accounts: Accounts;
  archive: ProjectArchive;
}

export async function projectRoutes(
  app: FastifyInstance,
  options: ProjectRoutesOptions
): Promise<void> {
  const controller = new ProjectController(options.accounts, options.archive);

  app.setErrorHandler((error) => {
    throw controller.failure(error);
  });

  app.route({
    method: "GET",
    url: "",
    handler: (request) => controller.access(request)
  });
  app.route({
    method: "GET",
    url: PROJECT_ARCHIVE_PATH,
    handler: (request, reply) => controller.archive(request, reply)
  });
}
