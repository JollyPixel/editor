// Import Third-party Dependencies
import type {
  APIRequestContext,
  Locator,
  Page
} from "@playwright/test";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import {
  Client,
  connectWebSocket
} from "@jolly-pixel/network/client";
import {
  GOLEM_TOKENS_URL_PATH,
  createdAgentTokenReplySchema,
  type AgentChatEntry
} from "@jolly-pixel/server";
import { AgentChatClient } from "@jolly-pixel/server/client";

export class GolemChatPane {
  readonly root: Locator;
  readonly agents: Locator;
  readonly messages: Locator;
  readonly prompt: Locator;
  readonly close: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.getByRole("complementary", { name: "Golem chat" });
    this.agents = this.root.getByRole("list", { name: "Agents" });
    this.messages = this.root.getByRole("list", { name: "Messages" });
    this.prompt = this.root.getByRole("textbox", {
      name: "Message to the agents"
    });
    this.close = this.root.getByRole("button", {
      name: "Close the golem chat"
    });
  }
}

export class TestAgent implements Disposable {
  static async connect(
    request: APIRequestContext,
    baseURL: string,
    name: string
  ): Promise<TestAgent> {
    const response = await request.post(GOLEM_TOKENS_URL_PATH, {
      data: { name }
    });
    const { value } = createdAgentTokenReplySchema.parse(await response.json());
    const socketUrl = new URL(DEFAULT_WEBSOCKET_PATH, baseURL);
    socketUrl.protocol = "ws:";
    const client = new Client({
      reconnect: false,
      socket: () => connectWebSocket({
        url: socketUrl.href,
        credential: value
      })
    });
    const chat = AgentChatClient.join(client);
    await chat.ready;

    return new TestAgent(client, chat);
  }

  readonly chat: AgentChatClient;

  #client: Client;

  constructor(
    client: Client,
    chat: AgentChatClient
  ) {
    this.#client = client;
    this.chat = chat;
  }

  heard(
    text: string
  ): Promise<AgentChatEntry> {
    const { promise, resolve } = Promise.withResolvers<AgentChatEntry>();
    const unsubscribe = this.chat.subscribe((entry) => {
      if (entry.text === text) {
        unsubscribe();
        resolve(entry);
      }
    });

    return promise;
  }

  [Symbol.dispose](): void {
    this.chat.dispose();
    this.#client.destroy();
  }
}
