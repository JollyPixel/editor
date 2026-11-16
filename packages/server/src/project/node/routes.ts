// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import { domainFailures } from "../../http/node/apiFailure.ts";
import { downloadRoute } from "../../http/node/downloadRoute.ts";
import {
  PROJECT_ROUTES,
  settingsUpdateSchema,
  type ProjectReply,
  type SettingsUpdate
} from "../api.ts";
import { ProjectRightRefusedError } from "../errors/ProjectRightRefusedError.ts";
import { InvalidSettingsError } from "./errors/InvalidSettingsError.ts";
import { RoleInUseError } from "./errors/RoleInUseError.ts";
import { StaleSettingsError } from "./errors/StaleSettingsError.ts";
import { UnknownAssetError } from "./errors/UnknownAssetError.ts";
import type { ProjectArchive } from "./ProjectArchive.ts";
import type { ProjectSettings } from "./ProjectSettings.ts";

// CONSTANTS
const kMaxSettingsBytes = 256 * 1_024;

export const projectFailures = domainFailures([
  [ProjectRightRefusedError, 403, "refused"],
  [UnknownAssetError, 404, "not-found"],
  [InvalidSettingsError, 400, "invalid-settings"],
  [RoleInUseError, 409, "role-in-use"],
  [StaleSettingsError, 409, "stale-settings"]
]);

export interface ProjectRoutesOptions {
  archive: ProjectArchive;
  settings: ProjectSettings;
}

interface ReplaceSettingsRoute {
  Body: SettingsUpdate;
}

export async function projectRoutes(
  app: FastifyInstance,
  options: ProjectRoutesOptions
): Promise<void> {
  const { archive, settings } = options;
  const {
    rights,
    archive: archiveRoute,
    settings: settingsRoute,
    sections,
    replaceSettings
  } = PROJECT_ROUTES;

  app.route({
    method: rights.method,
    url: rights.path,
    handler: (request): ProjectReply => settings
      .rights(signedInAccount(request))
      .toJSON()
  });
  downloadRoute(app, {
    route: archiveRoute,
    fileName: archive.fileName,
    body: (request) => archive.export(signedInAccount(request))
  });
  app.route({
    method: settingsRoute.method,
    url: settingsRoute.path,
    handler: (request) => settings.read(signedInAccount(request))
  });
  app.route({
    method: sections.method,
    url: sections.path,
    handler: () => settings.sections()
  });
  app.route<ReplaceSettingsRoute>({
    method: replaceSettings.method,
    url: replaceSettings.path,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: settingsUpdateSchema
    },
    handler: (request) => settings.replace(
      signedInAccount(request),
      request.body
    )
  });
}
