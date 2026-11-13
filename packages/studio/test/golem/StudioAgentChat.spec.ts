// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PEER_ACTIVITY_KEY } from "@jolly-pixel/network";
import type { AgentChatEntry } from "@jolly-pixel/server";
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
  via: "golem"
};

function entry(
  id: string,
  author: { username: string; via?: string; },
  text: string
): AgentChatEntry {
  return {
    id,
    clientId: `${author.username}-client`,
    ...author,
    text,
    at: 0
  };
}

describe("StudioAgentChat", () => {
  test("lists the agents in the chat with what they are doing, and no person", () => {
    const harness = chatRoomHarness();
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      new NotificationQueue()
    );

    harness.addPeer("alice", { username: "Alice" });
    harness.addPeer("builder", kAgentProfile, {
      [PEER_ACTIVITY_KEY]: {
        label: "Placing trees",
        progress: 0.5,
        assetId: "scene-1"
      }
    });
    harness.addPeer("helper", {
      ...kAgentProfile,
      username: "Helper"
    });

    assert.deepEqual(
      chat.agents.map(({ username, activity }) => [username, activity]),
      [
        ["Builder", { label: "Placing trees · 50%", assetId: "scene-1" }],
        ["Helper", null]
      ]
    );
  });

  test("notifies an agent's message only while the pane is hidden", () => {
    const harness = chatRoomHarness();
    const notifications = new NotificationQueue();
    using chat = new StudioAgentChat(
      new AgentChatClient(harness.room),
      notifications
    );
    harness.history([entry("1", { username: "Alice" }, "Add a tower")]);

    harness.said(entry("2", { username: "Alice" }, "Make it red"));
    harness.said(entry("3", kAgentProfile, "Starting"));
    chat.show();
    harness.said(entry("4", kAgentProfile, "Done"));

    assert.deepEqual(readChips(notifications), ["info Builder: Starting"]);
    assert.deepEqual(
      chat.lines.map((line) => line.entry.text),
      ["Add a tower", "Make it red", "Starting", "Done"]
    );
  });

  test("lets only a role that writes in the chat send", () => {
    using reader = new StudioAgentChat(
      new AgentChatClient(chatRoomHarness("read").room),
      new NotificationQueue()
    );

    assert.equal(reader.canSay, false);
  });
});
