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
export const AGENT_CHAT_ANSWER = "agent-chat:answer";
export const AGENT_CHAT_ANSWERED = "agent-chat:answered";
export const AGENT_CHAT_CANCEL = "agent-chat:cancel";
export const AGENT_CHAT_CANCELLED = "agent-chat:cancelled";
export const AGENT_CHAT_TEXT_MAX_LENGTH = 4_000;
export const AGENT_CHAT_HISTORY_LENGTH = 200;
export const AGENT_CHAT_ID_MAX_LENGTH = 100;
export const AGENT_BRIDGE_PRESENCE_KEY = "agentBridge";
export const AGENT_BRIDGE_TITLE_MAX_LENGTH = 500;
export const AGENT_BRIDGE_PERMISSIONS_MAX_LENGTH = 20;
export const AGENT_BRIDGE_OPTIONS_MAX_LENGTH = 10;

const kTitleSchema = z.string().max(AGENT_BRIDGE_TITLE_MAX_LENGTH);

export const agentChatIdSchema = z.string()
  .min(1)
  .max(AGENT_CHAT_ID_MAX_LENGTH);

export const agentChatActivitySchema = z.strictObject({
  ...peerActivitySchema.shape,
  assetId: z.string().min(1)
});

export const agentBridgePermissionSchema = z.strictObject({
  id: agentChatIdSchema,
  title: kTitleSchema,
  options: z.array(z.strictObject({
    optionId: agentChatIdSchema,
    name: kTitleSchema,
    kind: z.enum([
      "allow_once",
      "allow_always",
      "reject_once",
      "reject_always"
    ])
  })).min(1).max(AGENT_BRIDGE_OPTIONS_MAX_LENGTH)
});

export const agentBridgeStateSchema = z.strictObject({
  turn: z.enum(["idle", "running"]),
  tool: kTitleSchema.optional(),
  permissions: z.array(agentBridgePermissionSchema)
    .max(AGENT_BRIDGE_PERMISSIONS_MAX_LENGTH)
});

export type AgentChatCommand = InferMessage<typeof agentChatCommandProtocol>;
export type AgentChatMessage = InferMessage<typeof agentChatMessageProtocol>;
export type AgentChatSaid = Extract<
  AgentChatMessage,
  { type: typeof AGENT_CHAT_SAID; }
>;
export type AgentChatEntry = Omit<AgentChatSaid, "type">;
export type AgentBridgeControl = Extract<
  AgentChatMessage,
  { type: typeof AGENT_CHAT_ANSWERED | typeof AGENT_CHAT_CANCELLED; }
>;
export type AgentChatActivity = z.infer<typeof agentChatActivitySchema>;
export type AgentBridgePermission = z.infer<
  typeof agentBridgePermissionSchema
>;
export type AgentBridgeState = z.infer<typeof agentBridgeStateSchema>;

export function parseAgentBridgeState(
  presence: PeerMetadata | undefined
): AgentBridgeState | null {
  const parsed = agentBridgeStateSchema.safeParse(
    presence?.[AGENT_BRIDGE_PRESENCE_KEY]
  );

  return parsed.success ? parsed.data : null;
}

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
