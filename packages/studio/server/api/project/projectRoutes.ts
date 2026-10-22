// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  ProjectController,
  type ReplaceAccessRoute,
  type ReplaceKindsRoute
} from "./ProjectController.ts";
import {
  ACCESS_SECTION,
  KINDS_SECTION,
  PROJECT_ARCHIVE_PATH,
  PROJECT_SETTINGS_PATH,
  accessChangeSchema,
  kindOptionsSchema
} from "../../../src/project/routes.ts";
import type { ProjectArchive } from "../../project/ProjectArchive.ts";
import type { ProjectSettings } from "../../project/ProjectSettings.ts";

// CONSTANTS
const kMaxSettingsBytes = 64 * 1_024;

export interface ProjectRoutesOptions {
  accounts: Accounts;
  archive: ProjectArchive;
  settings: ProjectSettings;
}

export async function projectRoutes(
  app: FastifyInstance,
  options: ProjectRoutesOptions
): Promise<void> {
  const controller = new ProjectController(
    options.accounts,
    options.archive,
    options.settings
  );

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
  app.route({
    method: "GET",
    url: PROJECT_SETTINGS_PATH,
    handler: (request) => controller.settings(request)
  });
  app.route<ReplaceKindsRoute>({
    method: "PUT",
    url: `${PROJECT_SETTINGS_PATH}/${KINDS_SECTION}`,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: kindOptionsSchema
    },
    handler: (request) => controller.replaceKinds(request)
  });
  app.route<ReplaceAccessRoute>({
    method: "PUT",
    url: `${PROJECT_SETTINGS_PATH}/${ACCESS_SECTION}`,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: accessChangeSchema
    },
    handler: (request) => controller.replaceAccess(request)
  });
}
