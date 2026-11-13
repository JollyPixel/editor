// Import Third-party Dependencies
import {
  MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";
import * as z from "zod";

// Import Internal Dependencies
import {
  AGENT_CHAT_HISTORY,
  AGENT_CHAT_HISTORY_LENGTH,
  AGENT_CHAT_SAID,
  AGENT_CHAT_SAY,
  AGENT_CHAT_TEXT_MAX_LENGTH
} from "./chat.ts";

// CONSTANTS
const kTextSchema = z.string()
  .max(AGENT_CHAT_TEXT_MAX_LENGTH)
  .regex(/\S/);
const kEntrySchema = z.object({
  id: z.string(),
  clientId: z.string(),
  peerId: z.string().optional(),
  username: z.string(),
  via: z.string().optional(),
  text: kTextSchema,
  assetId: z.string().optional(),
  at: z.number()
});

export const agentChatCommandProtocol = new MessageProtocol(
  z.object({
    type: z.literal(AGENT_CHAT_SAY),
    text: kTextSchema,
    assetId: z.string().optional()
  }),
  {
    discriminator: "type"
  }
);

export const agentChatMessageProtocol = new MessageProtocol(
  z.union([
    kEntrySchema.extend({
      type: z.literal(AGENT_CHAT_SAID)
    }),
    z.object({
      type: z.literal(AGENT_CHAT_HISTORY),
      messages: z.array(kEntrySchema).max(AGENT_CHAT_HISTORY_LENGTH)
    })
  ]),
  {
    discriminator: "type"
  }
);

export const agentChatProtocols: MessageProtocols = {
  inbound: agentChatCommandProtocol,
  outbound: agentChatMessageProtocol
};
