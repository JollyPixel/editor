// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../authentication.ts";
import {
  GAME_ROUTES,
  artifactParamsSchema,
  gameQuerySchema,
  type ArtifactParams,
  type GameQuery
} from "../../../shared/api/game.ts";
import type { StudioGame } from "../../game/StudioGame.ts";

export interface GameRoutesOptions {
  game: StudioGame;
}

interface ManifestRoute {
  Querystring: GameQuery;
}

interface ArtifactRoute {
  Params: ArtifactParams;
}

export async function gameRoutes(
  app: FastifyInstance,
  options: GameRoutesOptions
): Promise<void> {
  const { game } = options;
  const { manifest, artifact } = GAME_ROUTES;

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
    handler: async(request, reply) => {
      const built = await game.artifact(
        signedInAccount(request),
        request.params.assetId,
        request.params.revision
      );

      return reply
        .type(built.type)
        .header("cache-control", built.cacheControl)
        .send(Buffer.from(
          built.bytes.buffer,
          built.bytes.byteOffset,
          built.bytes.byteLength
        ));
    }
  });
}
