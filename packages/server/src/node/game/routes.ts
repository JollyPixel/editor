// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyReply
} from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../http/authentication.ts";
import {
  GAME_ROUTES,
  artifactParamsSchema,
  gameQuerySchema,
  moduleParamsSchema,
  moduleQuerySchema,
  type ArtifactParams,
  type GameQuery,
  type ModuleParams,
  type ModuleQuery
} from "../../game/api.ts";
import type {
  GameArtifact,
  StudioGame
} from "./StudioGame.ts";

export interface GameRoutesOptions {
  game: StudioGame;
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
  const { game } = options;
  const { manifest, artifact, module } = GAME_ROUTES;

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
