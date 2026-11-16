// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyReply
} from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import { domainFailures } from "../../http/node/apiFailure.ts";
import { downloadRoute } from "../../http/node/downloadRoute.ts";
import {
  GAME_ROUTES,
  artifactParamsSchema,
  gameExportQuerySchema,
  gameQuerySchema,
  moduleParamsSchema,
  moduleQuerySchema,
  type ArtifactParams,
  type GameExportQuery,
  type GameQuery,
  type ModuleParams,
  type ModuleQuery
} from "../api.ts";
import { GameBuildError } from "./errors/GameBuildError.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import type { GameExport } from "./GameExport.ts";
import type {
  GameArtifact,
  StudioGame
} from "./StudioGame.ts";

export const gameFailures = domainFailures([
  [GameBuildError, 422, "build-failed"],
  [GameExportError, 409, "not-exportable"]
]);

export interface GameRoutesOptions {
  game: StudioGame;
  gameExport: GameExport;
}

interface ManifestRoute {
  Querystring: GameQuery;
}

interface ArtifactRoute {
  Params: ArtifactParams;
}

interface ModuleRoute {
  Params: ModuleParams;
  Querystring: ModuleQuery;
}

export async function gameRoutes(
  app: FastifyInstance,
  options: GameRoutesOptions
): Promise<void> {
  const { game, gameExport } = options;
  const {
    manifest,
    artifact,
    module,
    export: exportRoute
  } = GAME_ROUTES;

  app.route<ManifestRoute>({
    method: manifest.method,
    url: manifest.path,
    schema: {
      querystring: gameQuerySchema
    },
    handler: (request) => game.manifest(
      signedInAccount(request),
      request.query.start
    )
  });
  app.route<ArtifactRoute>({
    method: artifact.method,
    url: artifact.path,
    config: {
      rateLimit: false
    },
    schema: {
      params: artifactParamsSchema
    },
    handler: async(request, reply) => sendArtifact(
      reply,
      await game.artifact(
        signedInAccount(request),
        request.params.assetId,
        request.params.revision
      )
    )
  });
  app.route<ModuleRoute>({
    method: module.method,
    url: module.path,
    config: {
      rateLimit: false
    },
    schema: {
      params: moduleParamsSchema,
      querystring: moduleQuerySchema
    },
    handler: async(request, reply) => sendArtifact(
      reply,
      await game.module(
        signedInAccount(request),
        request.params["*"],
        request.query.revision
      )
    )
  });
  downloadRoute<GameExportQuery>(app, {
    route: exportRoute,
    fileName: gameExport.fileName,
    schema: {
      querystring: gameExportQuerySchema
    },
    body: (request) => gameExport.export(
      signedInAccount(request),
      request.query.assets
    )
  });
}

function sendArtifact(
  reply: FastifyReply,
  built: GameArtifact
): FastifyReply {
  return reply
    .type(built.type)
    .header("cache-control", built.cacheControl)
    .send(Buffer.from(
      built.bytes.buffer,
      built.bytes.byteOffset,
      built.bytes.byteLength
    ));
}
