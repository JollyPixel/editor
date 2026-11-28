// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import {
  McpServer,
  type Server,
  type ServerCapabilities,
  type Transport
} from "@modelcontextprotocol/server";

// Import Internal Dependencies
import type { ChatChannel } from "../chat/ChatChannel.ts";
import {
  golemTarget,
  type GolemConnectOptions
} from "../peer/GolemConnectOptions.ts";
import { GolemSession } from "./GolemSession.ts";
import {
  CLAUDE_CHANNEL_CAPABILITIES,
  pushOwnerMessages
} from "./ownerChannel.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { registerResources } from "./resources.ts";
import { PACKAGE_ROOT } from "../packageRoot.ts";
import { registerAssetTools } from "./tools/asset.ts";
import { registerCatalogTools } from "./tools/catalog.ts";
import { registerChatTools } from "./tools/chat.ts";
import { registerPresenceTools } from "./tools/presence.ts";
import { registerScriptTools } from "./tools/script.ts";
import { registerStudioTools } from "./tools/studio.ts";

// CONSTANTS
export const GOLEM_MCP_SERVER_NAME = "jollypixel";

export const GOLEM_CHAT_MODES = ["standalone", "channel", "bridged"] as const;

const kManifest = path.join(PACKAGE_ROOT, "package.json");
const kChatModes: Record<GolemChatMode, ChatModeSetup> = {
  standalone: {
    instructions: "People talk to you in the golem chat: announce work " +
      "with chat_say, and call chat_next between steps and before saying " +
      "you are done.",
    capabilities: {},
    registerTools: registerChatTools,
    connected: () => undefined
  },
  channel: {
    instructions: "What your owner writes in the golem chat arrives as a " +
      "jollypixel channel event, with the author in username and the asset " +
      "in asset_id: answer it with chat_say. Call chat_next between steps " +
      "for what other people write.",
    capabilities: CLAUDE_CHANNEL_CAPABILITIES,
    registerTools: registerChatTools,
    connected: pushOwnerMessages
  },
  bridged: {
    instructions: "Your prompts are what your owner wrote in the golem " +
      "chat, and your replies are posted there: keep them short.",
    capabilities: {},
    registerTools: () => undefined,
    connected: () => undefined
  }
};

export type GolemChatMode = typeof GOLEM_CHAT_MODES[number];

interface ChatModeSetup {
  instructions: string;
  capabilities: ServerCapabilities;
  registerTools: (mcp: McpServer, session: GolemSession) => void;
  connected: (server: Server, chat: ChatChannel) => void;
}

export interface GolemMcpServerOptions extends GolemConnectOptions {
  /**
   * How the agent reads the golem chat: `"standalone"` polls it with
   * `chat_next`, `"channel"` also gets the token owner's messages pushed
   * as Claude Code channel events, which start a turn in an idle session,
   * and `"bridged"` runs under `jolly-golem bridge`, which delivers the
   * owner's messages and posts the replies, so the chat tools are left out.
   * @default "standalone"
   */
  chat?: GolemChatMode;
}

export class GolemMcpServer {
  readonly mcp: McpServer;

  #session: GolemSession;

  constructor(
    options: GolemMcpServerOptions = {}
  ) {
    const chat = kChatModes[options.chat ?? "standalone"];
    const { version } = JSON.parse(
      fs.readFileSync(kManifest, "utf-8")
    );
    const target = golemTarget(options);
    this.mcp = new McpServer(
      {
        name: GOLEM_MCP_SERVER_NAME,
        version
      },
      {
        instructions: instructions(chat.instructions),
        capabilities: chat.capabilities
      }
    );
    const { server } = this.mcp;
    this.#session = new GolemSession(
      target,
      (golem) => chat.connected(server, golem.chat)
    );
    server.onclose = () => {
      void this.#session.dispose();
    };

    registerStudioTools(this.mcp, this.#session);
    registerCatalogTools(this.mcp, this.#session);
    registerAssetTools(this.mcp, this.#session);
    registerPresenceTools(this.mcp, this.#session);
    chat.registerTools(this.mcp, this.#session);
    registerScriptTools(this.mcp, new ScriptRunner({
      target,
      scriptsDir: path.join(PACKAGE_ROOT, "local"),
      cwd: PACKAGE_ROOT
    }));
    registerResources(this.mcp, this.#session);
  }

  async connect(
    transport: Transport
  ): Promise<void> {
    await this.mcp.connect(transport);
    this.#session.golem().catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.mcp.close();
    await this.#session.dispose();
  }
}

function instructions(
  chat: string
): string {
  return [
    "You are a peer in a running JollyPixel studio: people see your name, " +
    "your focus and your edits live.",
    "Read jollypixel://guide before your first edit.",
    "Find assets with catalog_list, open one with asset_open, then read the " +
    "command schema it names before calling asset_apply. When it lists " +
    "intents and a guide, read the guide and prefer asset_intent.",
    "Send related commands in one asset_apply batch. It answers once the " +
    "studio accepted them; report success only then.",
    "Call catalog_tag before a bulk edit, and catalog_restore if it goes " +
    "wrong.",
    "Publish what you are doing with presence_activity during longer work.",
    chat,
    "For procedural or repetitive work (layouts, noise, hundreds of " +
    "commands) write a Node script with the @jolly-pixel/golem SDK and run " +
    "it with script_run instead of calling tools in a loop."
  ].join("\n");
}
