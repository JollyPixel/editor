// Import Third-party Dependencies
import type * as acp from "@agentclientprotocol/sdk";
import { parseAgentProfile } from "@jolly-pixel/accounts";
import type { Client } from "@jolly-pixel/network/client";
import {
  AGENT_CHAT_ANSWERED,
  type AgentBridgeControl,
  type AgentChatEntry
} from "@jolly-pixel/server";
import {
  AgentChatClient,
  AgentChatUnavailableError
} from "@jolly-pixel/server/client";

// Import Internal Dependencies
import { GOLEM_MCP_SERVER_NAME } from "../mcp/GolemMcpServer.ts";
import {
  golemTarget,
  type GolemConnectOptions,
  type GolemTarget
} from "../peer/GolemConnectOptions.ts";
import { StudioUnreachableError } from "../peer/errors/StudioUnreachableError.ts";
import { studioClient } from "../peer/studioClient.ts";
import { AgentSession } from "./AgentSession.ts";
import { ChatRelay } from "./ChatRelay.ts";
import { NotAnAgentTokenError } from "./errors/NotAnAgentTokenError.ts";

export interface BridgedMcpCommand {
  command: string;
  args: string[];
}

export interface GolemBridgeOptions extends GolemConnectOptions {
  agent: acp.Stream;
  /**
   * How the agent starts the golem MCP server, such as
   * `node jolly-golem.js mcp --bridged`. The bridge adds the studio URL and
   * the token to its environment.
   */
  mcp: BridgedMcpCommand;
  /**
   * The agent session's working directory.
   * @default process.cwd()
   */
  cwd?: string;
}

interface BridgeParts {
  client: Client;
  chat: AgentChatClient;
  relay: ChatRelay;
  session: AgentSession;
  ownerId: string;
  revoked: AbortSignal;
}

export class GolemBridge implements AsyncDisposable {
  static async open(
    options: GolemBridgeOptions
  ): Promise<GolemBridge> {
    const target = golemTarget(options);
    const { client, revoked } = studioClient(target);
    const chat = await AgentChatClient.connect(client, {
      timeoutMs: target.timeoutMs,
      signal: revoked
    }).catch((error: unknown) => {
      client.destroy();

      throw error instanceof AgentChatUnavailableError ?
        new StudioUnreachableError(target.url.href, { cause: error }) :
        error;
    });
    try {
      const profile = parseAgentProfile(chat.room.profile);
      if (profile === null) {
        throw new NotAnAgentTokenError();
      }

      const relay = new ChatRelay(chat);
      const session = await AgentSession.start(options.agent, relay, {
        cwd: options.cwd ?? process.cwd(),
        mcpServers: [golemMcpServer(target, options.mcp)]
      });

      return new GolemBridge({
        client,
        chat,
        relay,
        session,
        ownerId: profile.ownerId,
        revoked
      });
    }
    catch (error) {
      chat.dispose();
      client.destroy();

      throw error;
    }
  }

  readonly ownerId: string;
  readonly closed: Promise<void>;

  #client: Client;
  #chat: AgentChatClient;
  #relay: ChatRelay;
  #session: AgentSession;
  #prompts: string[] = [];
  #running = false;
  #unsubscribe: (() => void)[];

  constructor(
    parts: BridgeParts
  ) {
    this.ownerId = parts.ownerId;
    this.#client = parts.client;
    this.#chat = parts.chat;
    this.#relay = parts.relay;
    this.#session = parts.session;
    this.closed = Promise.race([
      parts.session.closed,
      aborted(parts.revoked)
    ]);
    this.closed.catch(() => undefined);
    this.#unsubscribe = [
      parts.chat.subscribe(this.#onSaid),
      parts.chat.subscribeControls(this.#onControl)
    ];
    this.#relay.idle();
  }

  async close(): Promise<void> {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    this.#prompts.length = 0;
    this.#session.close();
    await this.#relay.close();
    this.#chat.dispose();
    this.#client.destroy();
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }

  async #drain(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;
    try {
      let text = this.#prompts.shift();
      while (text !== undefined) {
        const prompt = text;
        await this.#relay.turn(() => this.#session.prompt(prompt));
        text = this.#prompts.shift();
      }
    }
    finally {
      this.#running = false;
      this.#relay.idle();
    }
  }

  #cancel(): void {
    this.#prompts.length = 0;
    if (this.#running) {
      this.#session.cancel();
    }
    this.#relay.cancelPermissions();
  }

  readonly #onSaid = (
    entry: AgentChatEntry
  ): void => {
    if (entry.peerId === this.ownerId) {
      this.#prompts.push(entry.text);
      void this.#drain();
    }
  };

  readonly #onControl = (
    control: AgentBridgeControl
  ): void => {
    if (control.peerId !== this.ownerId) {
      return;
    }

    if (control.type === AGENT_CHAT_ANSWERED) {
      this.#relay.answer(control.requestId, control.optionId);
    }
    else {
      this.#cancel();
    }
  };
}

function golemMcpServer(
  target: GolemTarget,
  mcp: BridgedMcpCommand
): acp.McpServer {
  return {
    name: GOLEM_MCP_SERVER_NAME,
    command: mcp.command,
    args: mcp.args,
    env: [
      {
        name: "JOLLY_STUDIO_URL",
        value: target.url.href
      },
      {
        name: "JOLLY_GOLEM_TOKEN",
        value: target.token
      }
    ]
  };
}

function aborted(
  signal: AbortSignal
): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);

      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true
    });
  });
}
