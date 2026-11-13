// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import { sceneDocumentKind } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { StudioStatus } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import { ChatPeer } from "../helpers/ChatPeer.ts";
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  actorNamed,
  createForest
} from "../helpers/mcpScene.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kTimeoutMs = 15_000;
const kGolemDocs = path.join(import.meta.dirname, "..", "..", "docs");
const kNoStudio = "http://127.0.0.1:9";

interface SchemaVariant {
  properties: {
    action: {
      const: string;
    };
  };
}

interface ChatMessage {
  username: string;
  text: string;
}

interface TruncatedResult {
  truncated: boolean;
  length: number;
  head: string;
}

function renamed(
  id: string,
  name: string
): object {
  return {
    action: "actor-renamed",
    id,
    name
  };
}

function pillar(
  index: number
): object {
  return {
    id: `pillar-${index}`,
    name: `Pillar ${index}`,
    parentId: null,
    visible: true,
    transform: {
      position: {
        x: index,
        y: 0,
        z: 0
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0
      },
      scale: {
        x: 1,
        y: 1,
        z: 1
      }
    },
    components: []
  };
}

describe("GolemMcpServer", { timeout: kTimeoutMs }, () => {
  test("hears a person in the chat and answers them", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    const builder = await createAgentToken(backend, alice, "Builder");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: builder.value
    });
    await agent.call("studio_status");
    using person = await ChatPeer.join(backend, alice);

    const heard = agent.call<ChatMessage[]>("chat_next", {
      timeoutMs: kTimeoutMs
    });
    await person.chat.say("Add a tower");
    assert.deepEqual(
      (await heard).map(({ username, text }) => [username, text]),
      [["Alice", "Add a tower"]]
    );

    await agent.call("chat_say", { text: "On it" });
    await person.until(() => person.chat.messages.length === 2);
    assert.deepEqual(
      person.chat.messages.map(({ username, via, text }) => [username, via, text]),
      [["Alice", undefined, "Add a tower"], ["Builder", "golem", "On it"]]
    );
  });

  test("creates and edits a scene a peer watches, then reports it open", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    const builder = await createAgentToken(backend, bob, "Builder");
    const watcher = await createAgentToken(backend, bob, "Watcher");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: builder.value
    });

    const assetId = await createForest(agent);
    assert.deepEqual(await agent.call("asset_open", { assetId }), {
      assetId,
      kind: "scene",
      schema: "jollypixel://schemas/scene"
    });
    using peer = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: watcher.value,
      assetId,
      documentKind: sceneDocumentKind()
    });
    const sunId = await actorNamed(agent, assetId, "Sun");

    await agent.call("asset_apply", {
      assetId,
      commands: [renamed(sunId, "Moon")]
    });
    await agent.call("presence_activity", {
      assetId,
      label: "Lighting the night"
    });

    await peer.until(() => peer.synced.document.tree.actor(sunId)?.name === "Moon" &&
      peer.peerNamed("Builder")?.presence.activity !== undefined);
    assert.deepEqual(
      peer.peerNamed("Builder")?.presence.activity,
      { label: "Lighting the night" }
    );
    const status = await agent.call<StudioStatus>("studio_status");
    assert.deepEqual(status.assets, [
      {
        assetId,
        kind: "scene",
        unanswered: 0,
        peers: [
          {
            name: "Watcher",
            role: "admin",
            via: "golem"
          }
        ]
      }
    ]);
    assert.deepEqual(await agent.call("catalog_list", { folder: "levels" }), [
      {
        assetId,
        kind: "scene",
        path: "levels/forest.scene.json"
      }
    ]);
  });

  test("restores a tag while the scene is open", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const assetId = await createForest(agent);
    const sunId = await actorNamed(agent, assetId, "Sun");
    await agent.call("catalog_tag", {
      assetId,
      name: "before-night"
    });
    await agent.call("asset_apply", {
      assetId,
      commands: [renamed(sunId, "Moon")]
    });

    await agent.call("catalog_restore", {
      assetId,
      tag: "before-night"
    });

    assert.equal(await actorNamed(agent, assetId, "Sun"), sunId);
  });

  test("truncates a read too large for one tool result", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const assetId = await createForest(agent);
    await agent.call("asset_apply", {
      assetId,
      commands: Array.from({ length: 300 }, (_, index) => {
        return {
          action: "actor-added",
          actors: [pillar(index)]
        };
      })
    });

    const read = await agent.call<TruncatedResult>("asset_read", { assetId });

    assert.equal(read.truncated, true);
    assert.ok(read.length > read.head.length);
  });

  test("tells the agent the studio is unreachable", async() => {
    await using agent = await McpAgent.connect({
      url: kNoStudio,
      token: "any",
      timeoutMs: 100
    });

    const error = await agent.error("studio_status");

    assert.match(error, /studio at http:\/\/127\.0\.0\.1:9\/ is not reachable/);
  });

  test("serves kind schemas and package docs, but no file outside docs/", async() => {
    await using agent = await McpAgent.connect({
      url: kNoStudio,
      token: "any"
    });

    const schema = JSON.parse(await agent.read("jollypixel://schemas/scene"));
    const actions = schema.oneOf.map(
      (command: SchemaVariant) => command.properties.action.const
    );
    assert.ok(actions.includes("actor-renamed"));
    assert.equal(
      await agent.read("jollypixel://docs/golem/Golem.md"),
      fs.readFileSync(path.join(kGolemDocs, "Golem.md"), "utf-8")
    );
    await assert.rejects(
      agent.read("jollypixel://docs/golem/..%2FSPEC.md"),
      /No documentation/
    );
  });
});
