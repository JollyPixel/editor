// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChatPeer } from "../helpers/ChatPeer.ts";
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kTimeoutMs = 15_000;
const kNoStudio = "http://127.0.0.1:9";

interface ChatMessage {
  username: string;
  text: string;
}

async function chatTools(
  agent: McpAgent
): Promise<string[]> {
  const { tools } = await agent.client.listTools();

  return tools
    .map(({ name }) => name)
    .filter((name) => name.startsWith("chat_"))
    .sort();
}

describe("GolemMcpServer chat tools", { timeout: kTimeoutMs }, () => {
  test("hears what a person wrote before its first tool call, and answers them", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    const builder = await createAgentToken(backend, alice, "Builder");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: builder.value
    });
    using person = await ChatPeer.join(backend, alice);
    await person.until(() => person.peerNamed("Builder") !== undefined);

    await person.chat.say("Add a tower");
    const heard = await agent.call<ChatMessage[]>("chat_next", {
      timeoutMs: kTimeoutMs
    });
    assert.deepEqual(
      heard.map(({ username, text }) => [username, text]),
      [["Alice", "Add a tower"]]
    );

    await agent.call("chat_say", { text: "On it" });
    await person.until(() => person.chat.messages.length === 2);
    assert.deepEqual(
      person.chat.messages.map(({ username, via, text }) => [username, via, text]),
      [["Alice", undefined, "Add a tower"], ["Builder", "golem", "On it"]]
    );
  });

  test("pushes its owner's messages as Claude channel events and leaves the others to chat_next", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    const bob = await registered(backend, "Bob");
    const builder = await createAgentToken(backend, alice, "Builder");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: builder.value,
      chat: "channel"
    });
    const pushed = Promise.withResolvers<unknown>();
    agent.client.fallbackNotificationHandler = async({ method, params }) => {
      if (method === "notifications/claude/channel") {
        pushed.resolve(params);
      }
    };
    using owner = await ChatPeer.join(backend, alice);
    using other = await ChatPeer.join(backend, bob);
    await owner.until(() => owner.peerNamed("Builder") !== undefined);

    await other.chat.say("Make it red");
    await owner.chat.say("Add a tower", { assetId: "forest" });

    assert.deepEqual(
      agent.client.getServerCapabilities()?.experimental,
      { "claude/channel": {} }
    );
    assert.deepEqual(await pushed.promise, {
      content: "Add a tower",
      meta: {
        username: "Alice",
        asset_id: "forest"
      }
    });
    const heard = await agent.call<ChatMessage[]>("chat_next", {
      timeoutMs: 0
    });
    assert.deepEqual(
      heard.map(({ username, text }) => [username, text]),
      [["Bob", "Make it red"]]
    );
  });

  test("leaves the chat tools to the bridge when bridged", async() => {
    await using standalone = await McpAgent.connect({
      url: kNoStudio,
      token: "any"
    });
    await using bridged = await McpAgent.connect({
      url: kNoStudio,
      token: "any",
      chat: "bridged"
    });

    assert.deepEqual(await chatTools(standalone), ["chat_next", "chat_say"]);
    assert.deepEqual(await chatTools(bridged), []);
  });
});
