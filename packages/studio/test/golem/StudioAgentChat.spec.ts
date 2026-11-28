// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PEER_ACTIVITY_KEY } from "@jolly-pixel/network";
import {
  AGENT_BRIDGE_PRESENCE_KEY,
  AGENT_CHAT_CANCEL,
  type AgentBridgeState,
  type AgentChatEntry
} from "@jolly-pixel/server";
import { AgentChatClient } from "@jolly-pixel/server/client";
import { NotificationQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StudioAgentChat } from "../../src/golem/StudioAgentChat.ts";
import { chatRoomHarness } from "../helpers/chatRoom.ts";
import { readChips } from "../helpers/notifications.ts";

// CONSTANTS
const kAgentProfile = {
  username: "Builder",
  peerId: "token-1",
  via: "golem",
  ownerId: "alice-id"
};
const kBobAgentProfile = {
  username: "Helper",
  peerId: "token-2",
  via: "golem",
  ownerId: "bob-id"
};
const kRunningBridge: AgentBridgeState = {
  turn: "running",
  tool: "Run pnpm install",
  permissions: []
};
const kTokens = {
  disconnect: async() => undefined
};

function entry(
  id: string,
  author: { username: string; via?: string; },
  text: string,
  at = 0
): AgentChatEntry {
  return {
    id,
    clientId: `${author.username}-client`,
    ...author,
    text,
    at
  };
}

describe("StudioAgentChat", () => {
  test("lists one agent per token with its owner and activity, and no person", () => {
    const harness = chatRoomHarness();
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      new NotificationQueue(),
      kTokens
    );

    harness.addPeer("alice", { username: "Alice" });
    harness.addPeer("builder", kAgentProfile, {
      [PEER_ACTIVITY_KEY]: {
        label: "Placing trees",
        progress: 0.5,
        assetId: "scene-1"
      }
    });
    harness.addPeer("builder-again", kAgentProfile);
    harness.addPeer("helper", {
      ...kAgentProfile,
      username: "Helper",
      peerId: "token-2"
    });

    assert.deepEqual(
      chat.agents.map(({ username, tokenId, ownerId, activity }) => [
        username,
        tokenId,
        ownerId,
        activity
      ]),
      [
        ["Builder", "token-1", "alice-id", { label: "Placing trees · 50%", assetId: "scene-1" }],
        ["Helper", "token-2", "alice-id", null]
      ]
    );
  });

  test("notifies an agent's message only while the pane is hidden", () => {
    const harness = chatRoomHarness();
    const notifications = new NotificationQueue();
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      notifications,
      kTokens
    );
    harness.history([entry("1", { username: "Alice" }, "Add a tower")]);

    harness.said(entry("2", { username: "Alice" }, "Make it red"));
    harness.said(entry("3", kAgentProfile, "Starting"));
    chat.show();
    harness.said(entry("4", kAgentProfile, "Done"));

    assert.deepEqual(readChips(notifications), ["info Builder: Starting"]);
    assert.deepEqual(
      chat.groups.flatMap((group) => group.entries.map(({ text }) => text)),
      ["Add a tower", "Make it red", "Starting", "Done"]
    );
  });

  test("groups a sender's consecutive messages until another speaks or five minutes pass", () => {
    const harness = chatRoomHarness();
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      new NotificationQueue(),
      kTokens
    );
    const minute = 60_000;

    harness.history([
      entry("1", { username: "Alice" }, "Add a tower", 0),
      entry("2", { username: "Alice" }, "Make it red", minute),
      entry("3", kAgentProfile, "Starting", 2 * minute),
      entry("4", kAgentProfile, "Placed the base", 3 * minute),
      entry("5", kAgentProfile, "Done", 8 * minute),
      entry("6", { username: "Alice" }, "Thanks", 9 * minute)
    ]);

    assert.deepEqual(
      chat.groups.map(({ agent, entries }) => [
        entries[0].username,
        agent,
        entries.map(({ id }) => id)
      ]),
      [
        ["Alice", false, ["1", "2"]],
        ["Builder", true, ["3", "4"]],
        ["Builder", true, ["5"]],
        ["Alice", false, ["6"]]
      ]
    );
  });

  test("shows a bridge's state and the owner's name, and gives its controls to the owner only", () => {
    const harness = chatRoomHarness("write", {
      username: "Alice",
      peerId: "alice-id"
    });
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      new NotificationQueue(),
      kTokens
    );

    harness.addPeer("alice", { username: "Alice", peerId: "alice-id" });
    harness.addPeer("builder-mcp", kAgentProfile);
    harness.addPeer("builder-bridge", kAgentProfile, {
      [AGENT_BRIDGE_PRESENCE_KEY]: kRunningBridge
    });
    harness.addPeer("helper-bridge", kBobAgentProfile, {
      [AGENT_BRIDGE_PRESENCE_KEY]: kRunningBridge
    });

    assert.deepEqual(
      chat.agents.map(({ username, ownerName, bridge, controls }) => [
        username,
        ownerName,
        bridge?.clientId,
        controls?.clientId
      ]),
      [
        ["Builder", "Alice", "builder-bridge", "builder-bridge"],
        ["Helper", null, "helper-bridge", undefined]
      ]
    );
    assert.equal(chat.stopOwnBridges(), 1);
    assert.deepEqual(harness.sent, [
      {
        type: AGENT_CHAT_CANCEL,
        bridgeClientId: "builder-bridge"
      }
    ]);
  });

  test("lets only a role that writes in the chat send", () => {
    using reader = new StudioAgentChat(
      new AgentChatClient(chatRoomHarness("read").room),
      new NotificationQueue(),
      kTokens
    );

    assert.equal(reader.canSay, false);
  });
});
