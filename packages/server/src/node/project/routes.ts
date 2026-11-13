// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { FastifyInstance } from "fastify";
import { ARCHIVE_MIME_TYPE } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { signedInAccount } from "../http/authentication.ts";
import { AttachmentDisposition } from "../../http/AttachmentDisposition.ts";
import type { ApiRoute } from "../../http/api.ts";
import {
  PROJECT_ROUTES,
  settingsUpdateSchema,
  type ProjectReply,
  type SettingsUpdate
} from "../../project/api.ts";
import type { GameExport } from "../game/GameExport.ts";
import type { ProjectArchive } from "./ProjectArchive.ts";
import type { ProjectSettings } from "./ProjectSettings.ts";

// CONSTANTS
const kMaxSettingsBytes = 256 * 1_024;

export interface ProjectRoutesOptions {
  archive: ProjectArchive;
  gameExport: GameExport;
  settings: ProjectSettings;
}

interface ProjectDownload {
  readonly fileName: string;
  export(account: Account): Promise<Uint8Array>;
}

interface ReplaceSettingsRoute {
  Body: SettingsUpdate;
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
  downloadRoute(app, archiveRoute, archive);
  downloadRoute(app, game, gameExport);
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
