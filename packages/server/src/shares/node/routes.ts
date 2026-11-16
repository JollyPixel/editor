// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
import { ShareLifetime } from "../ShareLifetime.ts";
import {
  SHARES_ROUTES,
  createShareBodySchema,
  type CreateShareBody,
  type CreatedShareReply,
  type ShareLinksReply
} from "../api.ts";
import type { ProjectShares } from "./ProjectShares.ts";

export interface SharesRoutesOptions {
  shares: RequestScoped<ProjectShares>;
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
  const { list, create, revoke } = SHARES_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: (request): ShareLinksReply => {
      return {
        links: options.shares(request).list(
          signedInAccount(request)
        )
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
      const link = options.shares(request).create(
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
      options.shares(request).revoke(
        signedInAccount(request),
        request.params.linkId
      );

      return reply.code(204).send();
    }
  });
}
