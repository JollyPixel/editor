// Import Third-party Dependencies
import * as z from "zod";
import {
  agentTokenNameSchema,
  agentTokenSchema
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";

// CONSTANTS
export const GOLEM_TOKENS_URL_PATH = "/api/golem/tokens/";
export const GOLEM_TOKENS_ROUTES = {
  list: {
    method: "GET",
    path: ""
  },
  create: {
    method: "POST",
    path: ""
  },
  revoke: {
    method: "DELETE",
    path: ":tokenId"
  }
} as const satisfies Record<string, ApiRoute>;

export const createAgentTokenBodySchema = z.object({
  name: agentTokenNameSchema.optional()
});

export const createdAgentTokenReplySchema = z.object({
  token: agentTokenSchema,
  value: z.string()
});

export const agentTokensReplySchema = z.object({
  tokens: z.array(agentTokenSchema)
});

export type CreateAgentTokenBody = z.infer<typeof createAgentTokenBodySchema>;
export type CreatedAgentTokenReply = z.infer<typeof createdAgentTokenReplySchema>;
export type AgentTokensReply = z.infer<typeof agentTokensReplySchema>;
