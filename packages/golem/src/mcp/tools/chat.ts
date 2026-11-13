// Import Third-party Dependencies
import {
  AGENT_CHAT_TEXT_MAX_LENGTH,
  type AgentChatEntry
} from "@jolly-pixel/server";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import { CHAT_NEXT_TIMEOUT_MS } from "../../chat/ChatChannel.ts";
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
export const CHAT_NEXT_MAX_TIMEOUT_MS = 120_000;

export function registerChatTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "chat_say",
    {
      description: "Write in the studio's golem chat, which people read " +
        "in the chat pane. Announce work before starting it and say when " +
        "it is done.",
      inputSchema: z.object({
        text: z.string()
          .describe(`At most ${AGENT_CHAT_TEXT_MAX_LENGTH} characters.`),
        assetId: ASSET_ID_FIELD.optional()
      })
    },
    async({ text, assetId }) => {
      const { chat } = await session.golem();
      const said = await chat.say(text, { assetId });

      return jsonResult({
        id: said.id,
        at: said.at
      });
    }
  );

  server.registerTool(
    "chat_next",
    {
      description: "Read what people wrote in the chat since the last " +
        "call. Waits until someone writes or the timeout passes, then " +
        "returns the messages, or an empty list.",
      inputSchema: z.object({
        timeoutMs: z.number()
          .int()
          .min(0)
          .max(CHAT_NEXT_MAX_TIMEOUT_MS)
          .optional()
          .describe(`Defaults to ${CHAT_NEXT_TIMEOUT_MS}.`)
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ timeoutMs }) => {
      const { chat } = await session.golem();
      const messages = await chat.next({ timeoutMs });

      return jsonResult(messages.map(chatMessage));
    }
  );
}

function chatMessage(
  entry: AgentChatEntry
): Pick<AgentChatEntry, "username" | "text" | "assetId" | "at"> {
  return {
    username: entry.username,
    text: entry.text,
    assetId: entry.assetId,
    at: entry.at
  };
}
