// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { FastifyInstance } from "fastify";
import { ARCHIVE_MIME_TYPE } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { signedInAccount } from "../authentication.ts";
import { AttachmentDisposition } from "../../../shared/AttachmentDisposition.ts";
import type { ApiRoute } from "../../../shared/api/common.ts";
import {
  PROJECT_ROUTES,
  accessChangeSchema,
  gameSectionSchema,
  kindFilterSchema,
  kindOptionsSchema,
  type AccessChange,
  type GameSection,
  type KindFilterSection,
  type KindOptions,
  type ProjectReply
} from "../../../shared/api/project.ts";
import type { GameExport } from "../../game/GameExport.ts";
import type { ProjectArchive } from "../../project/ProjectArchive.ts";
import type { ProjectSettings } from "../../project/ProjectSettings.ts";

// CONSTANTS
const kMaxSettingsBytes = 64 * 1_024;

export interface ProjectRoutesOptions {
  archive: ProjectArchive;
  gameExport: GameExport;
  settings: ProjectSettings;
}

interface ProjectDownload {
  readonly fileName: string;
  export(account: Account): Promise<Uint8Array>;
}

interface ReplaceKindsRoute {
  Body: KindOptions;
}

interface ReplaceAccessRoute {
  Body: AccessChange;
}

interface ReplaceGameRoute {
  Body: GameSection;
}

interface ReplaceKindFilterRoute {
  Body: KindFilterSection;
}

export async function projectRoutes(
  app: FastifyInstance,
  options: ProjectRoutesOptions
): Promise<void> {
  const { archive, gameExport, settings } = options;
  const {
    rights,
    archive: archiveRoute,
    game,
    settings: settingsRoute,
    replaceKinds,
    replaceAccess,
    sections,
    replaceKindFilter,
    replaceGame
  } = PROJECT_ROUTES;

  app.route({
    method: rights.method,
    url: rights.path,
    handler: (request): ProjectReply => settings
      .rights(signedInAccount(request))
      .toJSON()
  });
  downloadRoute(app, archiveRoute, archive);
  downloadRoute(app, game, gameExport);
  app.route({
    method: settingsRoute.method,
    url: settingsRoute.path,
    handler: (request) => settings.read(signedInAccount(request))
  });
  app.route<ReplaceKindsRoute>({
    method: replaceKinds.method,
    url: replaceKinds.path,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: kindOptionsSchema
    },
    handler: (request) => settings.replaceKinds(
      signedInAccount(request),
      request.body
    )
  });
  app.route<ReplaceAccessRoute>({
    method: replaceAccess.method,
    url: replaceAccess.path,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: accessChangeSchema
    },
    handler: (request) => settings.replaceAccess(
      signedInAccount(request),
      request.body
    )
  });
  app.route({
    method: sections.method,
    url: sections.path,
    handler: () => settings.sections()
  });
  app.route<ReplaceKindFilterRoute>({
    method: replaceKindFilter.method,
    url: replaceKindFilter.path,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: kindFilterSchema
    },
    handler: (request) => settings.replaceKindFilter(
      signedInAccount(request),
      request.body
    )
  });
  app.route<ReplaceGameRoute>({
    method: replaceGame.method,
    url: replaceGame.path,
    bodyLimit: kMaxSettingsBytes,
    schema: {
      body: gameSectionSchema
    },
    handler: (request) => settings.replaceGame(
      signedInAccount(request),
      request.body
    )
  });
}

function downloadRoute(
  app: FastifyInstance,
  route: ApiRoute,
  download: ProjectDownload
): void {
  app.route({
    method: route.method,
    url: route.path,
    handler: async(request, reply) => {
      const bytes = await download.export(signedInAccount(request));
      const disposition = new AttachmentDisposition(download.fileName);

      return reply
        .type(ARCHIVE_MIME_TYPE)
        .header("content-disposition", disposition.toString())
        .send(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    }
  });
}
