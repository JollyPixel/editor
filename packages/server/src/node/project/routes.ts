// Import Node.js Dependencies
import type { Readable } from "node:stream";

// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyRequest,
  FastifySchema
} from "fastify";
import { ARCHIVE_MIME_TYPE } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { signedInAccount } from "../http/authentication.ts";
import { AttachmentDisposition } from "../../http/AttachmentDisposition.ts";
import type { ApiRoute } from "../../http/api.ts";
import {
  PROJECT_ROUTES,
  gameExportQuerySchema,
  settingsUpdateSchema,
  type GameExportQuery,
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

interface QueryRoute<TQuery> {
  Querystring: TQuery;
}

interface DownloadRoute<TQuery> {
  route: ApiRoute;
  fileName: string;
  schema?: FastifySchema;
  body(
    request: FastifyRequest<QueryRoute<TQuery>>
  ): Promise<Uint8Array | Readable>;
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
  downloadRoute(app, {
    route: archiveRoute,
    fileName: archive.fileName,
    body: (request) => archive.export(signedInAccount(request))
  });
  downloadRoute<GameExportQuery>(app, {
    route: game,
    fileName: gameExport.fileName,
    schema: {
      querystring: gameExportQuerySchema
    },
    body: (request) => gameExport.export(
      signedInAccount(request),
      request.query.assets
    )
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

function downloadRoute<TQuery = unknown>(
  app: FastifyInstance,
  download: DownloadRoute<TQuery>
): void {
  const disposition = new AttachmentDisposition(download.fileName);

  app.route<QueryRoute<TQuery>>({
    method: download.route.method,
    url: download.route.path,
    schema: download.schema,
    handler: async(request, reply) => reply
      .type(ARCHIVE_MIME_TYPE)
      .header("content-disposition", disposition.toString())
      .send(await download.body(request))
  });
}
