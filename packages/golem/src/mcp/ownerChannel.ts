// Import Third-party Dependencies
import type { AgentChatEntry } from "@jolly-pixel/server";
import type {
  Server,
  ServerCapabilities
} from "@modelcontextprotocol/server";

// Import Internal Dependencies
import type { ChatChannel } from "../chat/ChatChannel.ts";

// CONSTANTS
export const CLAUDE_CHANNEL_CAPABILITIES: ServerCapabilities = {
  experimental: {
    "claude/channel": {}
  }
};
const kChannelNotification = "notifications/claude/channel";

export function pushOwnerMessages(
  server: Server,
  chat: ChatChannel
): void {
  chat.followOwner((entry) => {
    server.notification({
      method: kChannelNotification,
      params: {
        content: entry.text,
        meta: channelMeta(entry)
      }
    }).catch((error: unknown) => {
      console.error(`The chat message was not pushed: ${String(error)}`);
    });
  });
}

function channelMeta(
  entry: AgentChatEntry
): Record<string, string> {
  return entry.assetId === undefined ?
    { username: entry.username } :
    {
      username: entry.username,
      asset_id: entry.assetId
    };
}
