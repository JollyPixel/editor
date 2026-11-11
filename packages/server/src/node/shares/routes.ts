// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../http/authentication.ts";
import { ShareLifetime } from "../../shares/ShareLifetime.ts";
import {
  SHARES_ROUTES,
  createShareBodySchema,
  type CreateShareBody,
  type CreatedShareReply,
  type ShareLinksReply
} from "../../shares/api.ts";
import type { StudioShares } from "./StudioShares.ts";

export interface SharesRoutesOptions {
  shares: StudioShares;
}

interface CreateShareRoute {
  Body: CreateShareBody;
}

interface RevokeShareRoute {
  Params: {
    linkId: string;
  };
}

export async function sharesRoutes(
  app: FastifyInstance,
  options: SharesRoutesOptions
): Promise<void> {
  const { shares } = options;
  const { list, create, revoke } = SHARES_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: (request): ShareLinksReply => {
      return {
        links: shares.list(signedInAccount(request))
      };
    }
  });
  app.route<CreateShareRoute>({
    method: create.method,
    url: create.path,
    schema: {
      body: createShareBodySchema
    },
    handler: (request, reply) => {
      const link = shares.create(
        signedInAccount(request),
        request.body.assetId,
        new ShareLifetime(request.body.lifetime)
      );

      return reply.code(201).send({
        link
      } satisfies CreatedShareReply);
    }
  });
  app.route<RevokeShareRoute>({
    method: revoke.method,
    url: revoke.path,
    handler: (request, reply) => {
      shares.revoke(signedInAccount(request), request.params.linkId);

      return reply.code(204).send();
    }
  });
}
