// Import Third-party Dependencies
import {
  PEER_ACTIVITY_KEY,
  peerActivitySchema,
  type InferMessage,
  type PeerMetadata
} from "@jolly-pixel/network";
import * as z from "zod";

// Import Internal Dependencies
import type {
  agentChatCommandProtocol,
  agentChatMessageProtocol
} from "./chat.schema.ts";

// CONSTANTS
export const AGENT_CHAT_ROOM = "agent-chat";
export const AGENT_CHAT_SAY = "agent-chat:say";
export const AGENT_CHAT_SAID = "agent-chat:said";
export const AGENT_CHAT_HISTORY = "agent-chat:history";
export const AGENT_CHAT_TEXT_MAX_LENGTH = 4_000;
export const AGENT_CHAT_HISTORY_LENGTH = 200;

export const agentChatActivitySchema = z.strictObject({
  ...peerActivitySchema.shape,
  assetId: z.string().min(1)
});

export type AgentChatCommand = InferMessage<typeof agentChatCommandProtocol>;
export type AgentChatMessage = InferMessage<typeof agentChatMessageProtocol>;
export type AgentChatSaid = Extract<
  AgentChatMessage,
  { type: typeof AGENT_CHAT_SAID; }
>;
export type AgentChatEntry = Omit<AgentChatSaid, "type">;
export type AgentChatActivity = z.infer<typeof agentChatActivitySchema>;

export function parseAgentChatActivity(
  presence: PeerMetadata | undefined
): AgentChatActivity | null {
  const parsed = agentChatActivitySchema.safeParse(
    presence?.[PEER_ACTIVITY_KEY]
  );

  return parsed.success ? parsed.data : null;
}

export function appendChatEntry(
  history: AgentChatEntry[],
  entry: AgentChatEntry
): void {
  history.push(entry);
  if (history.length > AGENT_CHAT_HISTORY_LENGTH) {
    history.shift();
  }
}
