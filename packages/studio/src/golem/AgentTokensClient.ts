// Import Third-party Dependencies
import {
  GOLEM_TOKENS_ROUTES,
  agentTokensReplySchema,
  createdAgentTokenReplySchema,
  type AgentTokensReply,
  type CreatedAgentTokenReply
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";

export class AgentTokensClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  list(): Promise<AgentTokensReply> {
    return this.#endpoint.json(GOLEM_TOKENS_ROUTES.list, agentTokensReplySchema);
  }

  create(
    name?: string
  ): Promise<CreatedAgentTokenReply> {
    return this.#endpoint.json(
      GOLEM_TOKENS_ROUTES.create,
      createdAgentTokenReplySchema,
      {
        body: {
          name
        }
      }
    );
  }

  async revoke(
    tokenId: string
  ): Promise<void> {
    await this.#endpoint.send(GOLEM_TOKENS_ROUTES.revoke, {
      params: {
        tokenId
      }
    });
  }
}
