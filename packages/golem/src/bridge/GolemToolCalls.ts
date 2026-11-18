// Import Third-party Dependencies
import type {
  RequestPermissionRequest,
  ToolCall,
  ToolCallUpdate
} from "@agentclientprotocol/sdk";
import * as z from "zod";

// Import Internal Dependencies
import { GOLEM_MCP_SERVER_NAME } from "../mcp/GolemMcpServer.ts";

// CONSTANTS
const kClaudeMetaSchema = z.object({
  claudeCode: z.object({
    mcpServer: z.object({
      name: z.string()
    })
  })
});
const kCodexMetaSchema = z.object({
  is_mcp_tool_approval: z.literal(true)
});
const kServerInputSchema = z.union([
  z.object({ server: z.string() }).transform((input) => input.server),
  z.object({ serverName: z.string() }).transform((input) => input.serverName)
]);

export class GolemToolCalls {
  #servers = new Map<string, string>();

  record(
    toolCall: ToolCall | ToolCallUpdate
  ): void {
    const server = kServerInputSchema.safeParse(toolCall.rawInput);
    if (server.success) {
      this.#servers.set(toolCall.toolCallId, server.data);
    }
  }

  isGolem(
    request: RequestPermissionRequest
  ): boolean {
    const claude = kClaudeMetaSchema.safeParse(request.toolCall._meta);
    if (claude.success) {
      return claude.data.claudeCode.mcpServer.name === GOLEM_MCP_SERVER_NAME;
    }
    if (!kCodexMetaSchema.safeParse(request._meta).success) {
      return false;
    }

    const server = kServerInputSchema.safeParse(request.toolCall.rawInput);
    const name = server.success ?
      server.data :
      this.#servers.get(request.toolCall.toolCallId);

    return name === GOLEM_MCP_SERVER_NAME;
  }

  clear(): void {
    this.#servers.clear();
  }
}
