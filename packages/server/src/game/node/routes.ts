// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyReply
} from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
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
import { GAME_FAILURES } from "../gameFailures.ts";
import type { GameExport } from "./GameExport.ts";
import type { GameArtifact } from "../PlayableGame.ts";
import type { ProjectGame } from "./ProjectGame.ts";

export const gameFailures = domainFailures(GAME_FAILURES);

export interface GameRoutesOptions {
  game: RequestScoped<ProjectGame>;
  gameExport: RequestScoped<GameExport>;
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
    handler: (request) => options.game(request)
      .playable(signedInAccount(request))
      .manifest(request.query.start)
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
      await options.game(request)
        .playable(signedInAccount(request))
        .artifact(request.params.assetId, request.params.revision)
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
      await options.game(request)
        .playable(signedInAccount(request))
        .module(request.params["*"], request.query.revision)
    )
  });
  downloadRoute<GameExportQuery>(app, {
    route: exportRoute,
    fileName: (request) => options.gameExport(request).fileName,
    schema: {
      querystring: gameExportQuerySchema
    },
    body: (request) => options.gameExport(request).export(
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
    .header("x-content-type-options", "nosniff")
    .send(Buffer.from(
      built.bytes.buffer,
      built.bytes.byteOffset,
      built.bytes.byteLength
    ));
}
