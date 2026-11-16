// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MESSAGE_EVENT } from "@jolly-pixel/network";
import {
  Client,
  connectWebSocket,
  type RoomRejectionEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { serveBackend } from "../../helpers/studioBackend.ts";
import {
  signedInSocket,
  type Browser,
  type ServedBackend
} from "#src/testing.ts";
import { AgentChatClient } from "#src/golem/AgentChatClient.ts";
import { AgentChatRefusedError } from "#src/golem/errors/AgentChatRefusedError.ts";
import {
  AGENT_CHAT_HISTORY_LENGTH,
  AGENT_CHAT_SAY,
  AGENT_CHAT_TEXT_MAX_LENGTH,
  type AgentChatCommand
} from "#src/golem/chat.ts";
import {
  GOLEM_TOKENS_URL_PATH,
  createdAgentTokenReplySchema,
  type CreatedAgentTokenReply
} from "#src/golem/api.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kTimeoutMs = 10_000;

async function signedIn(
  backend: ServedBackend,
  username: string
): Promise<Browser> {
  const account = backend.browser();
  await account.client.register(username, kPassword);

  return account;
}

async function agentToken(
  backend: ServedBackend,
  owner: Browser,
  name: string
): Promise<CreatedAgentTokenReply> {
  const response = await owner.fetch(
    new URL(`.${GOLEM_TOKENS_URL_PATH}`, backend.url),
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ name })
    }
  );

  return createdAgentTokenReplySchema.parse(await response.json());
}

function personClient(
  backend: ServedBackend,
  account: Browser
): Client {
  return new Client({
    reconnect: false,
    socket: () => signedInSocket(backend.socketUrl, account)
  });
}

function agentClient(
  backend: ServedBackend,
  token: CreatedAgentTokenReply
): Client {
  return new Client({
    reconnect: false,
    socket: () => connectWebSocket({
      url: backend.socketUrl,
      credential: token.value
    })
  });
}

async function joinChat(
  client: Client
): Promise<AgentChatClient> {
  const chat = AgentChatClient.join(client);
  await chat.ready;

  return chat;
}

describe("AgentChatExtension", { timeout: kTimeoutMs }, () => {
  test("names each author from its connection, not from the message", async() => {
    await using backend = await serveBackend();
    const alice = await signedIn(backend, "Alice");
    const builder = await agentToken(backend, alice, "Builder");
    const person = personClient(backend, alice);
    const agent = agentClient(backend, builder);
    try {
      const aliceChat = await joinChat(person);
      const agentChat = await joinChat(agent);
      const heard = Promise.withResolvers<void>();
      agentChat.subscribe((entry) => {
        if (entry.text === "Build a tower") {
          heard.resolve();
        }
      });

      const command: AgentChatCommand = {
        type: AGENT_CHAT_SAY,
        text: "Build a tower"
      };
      const forged = {
        ...command,
        username: "Mallory",
        via: "golem"
      };
      aliceChat.room.send(forged);
      await heard.promise;
      const reply = await agentChat.say("On it", {
        assetId: "map-overworld"
      });

      const [said] = agentChat.messages;
      assert.equal(said.username, "Alice");
      assert.equal(said.via, undefined);
      assert.equal(said.assetId, undefined);
      assert.deepEqual({
        username: reply.username,
        peerId: reply.peerId,
        via: reply.via,
        assetId: reply.assetId
      }, {
        username: "Builder",
        peerId: builder.token.id,
        via: "golem",
        assetId: "map-overworld"
      });
    }
    finally {
      person.destroy();
      agent.destroy();
    }
  });

  test("replays the last messages to a client that joins later", async() => {
    await using backend = await serveBackend();
    const alice = await signedIn(backend, "Alice");
    const builder = await agentToken(backend, alice, "Builder");
    const agent = agentClient(backend, builder);
    const person = personClient(backend, alice);
    try {
      const agentChat = await joinChat(agent);
      const said = Array.from(
        { length: AGENT_CHAT_HISTORY_LENGTH + 1 },
        (_, index) => agentChat.say(`step ${index + 1}`)
      );
      await Promise.all(said);

      const late = await joinChat(person);

      assert.equal(late.messages.length, AGENT_CHAT_HISTORY_LENGTH);
      assert.equal(late.messages.at(0)?.text, "step 2");
      assert.equal(
        late.messages.at(-1)?.text,
        `step ${AGENT_CHAT_HISTORY_LENGTH + 1}`
      );
    }
    finally {
      agent.destroy();
      person.destroy();
    }
  });

  test("refuses a message from a role that only reads", async() => {
    await using backend = await serveBackend({
      defaultRole: "spectator"
    });
    await signedIn(backend, "Alice");
    const bob = await signedIn(backend, "Bob");
    const reader = agentClient(backend, await agentToken(backend, bob, "Reader"));
    try {
      const chat = await joinChat(reader);

      await assert.rejects(chat.say("Hello"), AgentChatRefusedError);
      assert.equal(chat.room.can(AGENT_CHAT_SAY), "read");
    }
    finally {
      reader.destroy();
    }
  });

  test("refuses a message longer than the text limit", async() => {
    await using backend = await serveBackend();
    const alice = await signedIn(backend, "Alice");
    const person = personClient(backend, alice);
    try {
      const chat = await joinChat(person);
      const refused = Promise.withResolvers<RoomRejectionEvent>();
      chat.room.on("error", refused.resolve);

      const command: AgentChatCommand = {
        type: AGENT_CHAT_SAY,
        text: "x".repeat(AGENT_CHAT_TEXT_MAX_LENGTH + 1)
      };
      chat.room.send(command);

      assert.equal((await refused.promise).event, MESSAGE_EVENT);
    }
    finally {
      person.destroy();
    }
  });
});
