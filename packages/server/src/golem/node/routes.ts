// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import { AVATAR_MAX_BYTES } from "@jolly-pixel/accounts";
import type { AccountsRealm } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import {
  BINARY_BODY_SCHEMA,
  binaryUpload
} from "../../http/node/binaryUpload.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
import {
  GOLEM_TOKENS_ROUTES,
  createAgentTokenBodySchema,
  type AgentTokenReply,
  type AgentTokensReply,
  type CreateAgentTokenBody,
  type CreatedAgentTokenReply
} from "../api.ts";

export interface GolemRoutesOptions {
  realm: RequestScoped<AccountsRealm>;
}

interface CreateAgentTokenRoute {
  Body: CreateAgentTokenBody;
}

interface AgentTokenRoute {
  Params: {
    tokenId: string;
  };
}

interface ReplaceAgentAvatarRoute extends AgentTokenRoute {
  Body: Uint8Array;
}

export async function golemRoutes(
  app: FastifyInstance,
  options: GolemRoutesOptions
): Promise<void> {
  const {
    list,
    create,
    revoke,
    disconnect,
    replaceAvatar
  } = GOLEM_TOKENS_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: (request): AgentTokensReply => {
      return {
        tokens: options.realm(request).agentTokens.ownedBy(
          signedInAccount(request).id
        )
      };
    }
  });
  app.route<CreateAgentTokenRoute>({
    method: create.method,
    url: create.path,
    schema: {
      body: createAgentTokenBodySchema
    },
    handler: (request, reply) => {
      const created = options.realm(request).agentTokens.create({
        ownerId: signedInAccount(request).id,
        name: request.body.name
      });

      return reply.code(201).send(created satisfies CreatedAgentTokenReply);
    }
  });
  app.route<AgentTokenRoute>({
    method: revoke.method,
    url: revoke.path,
    handler: (request, reply) => {
      options.realm(request).agentTokens.revoke(
        signedInAccount(request).id,
        request.params.tokenId
      );

      return reply.code(204).send();
    }
  });
  app.route<AgentTokenRoute>({
    method: disconnect.method,
    url: disconnect.path,
    handler: (request, reply) => {
      options.realm(request).agentTokens.disconnect(
        signedInAccount(request).id,
        request.params.tokenId
      );

      return reply.code(204).send();
    }
  });

  await binaryUpload(app, (upload) => {
    upload.route<ReplaceAgentAvatarRoute>({
      method: replaceAvatar.method,
      url: replaceAvatar.path,
      bodyLimit: AVATAR_MAX_BYTES,
      schema: {
        body: BINARY_BODY_SCHEMA
      },
      handler: async(request): Promise<AgentTokenReply> => {
        return {
          token: await options.realm(request).agentTokens.replaceAvatar(
            signedInAccount(request).id,
            request.params.tokenId,
            request.body
          )
        };
      }
    });
  });
}
