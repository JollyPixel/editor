// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import {
  GOLEM_TOKENS_ROUTES,
  createAgentTokenBodySchema,
  type AgentTokensReply,
  type CreateAgentTokenBody,
  type CreatedAgentTokenReply
} from "../api.ts";

export interface GolemRoutesOptions {
  accounts: Accounts;
}

interface CreateAgentTokenRoute {
  Body: CreateAgentTokenBody;
}

interface AgentTokenRoute {
  Params: {
    tokenId: string;
  };
}

export async function golemRoutes(
  app: FastifyInstance,
  options: GolemRoutesOptions
): Promise<void> {
  const { agentTokens } = options.accounts;
  const {
    list,
    create,
    revoke,
    disconnect
  } = GOLEM_TOKENS_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: (request): AgentTokensReply => {
      return {
        tokens: agentTokens.ownedBy(signedInAccount(request).id)
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
      const created = agentTokens.create({
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
      agentTokens.revoke(
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
      agentTokens.disconnect(
        signedInAccount(request).id,
        request.params.tokenId
      );

      return reply.code(204).send();
    }
  });
}
