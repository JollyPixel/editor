// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  SCENE_SELECTION_PRESENCE_KEY,
  sceneDocumentKind
} from "@jolly-pixel/asset.scene/client";
import {
  parseAgentChatActivity,
  type AgentChatActivity
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { SceneAsset } from "#src/assets/scene/SceneAsset.ts";
import { Golem } from "#src/peer/Golem.ts";
import { GolemTokenRefusedError } from "#src/peer/errors/GolemTokenRefusedError.ts";
import { CommandDeniedError } from "#src/assets/errors/CommandDeniedError.ts";
import { ChatPeer } from "./helpers/ChatPeer.ts";
import { AssetPeer } from "./helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  revokeAgentToken,
  serveStudio
} from "./helpers/studio.ts";

// CONSTANTS
const kTimeoutMs = 10_000;

function actorNamed(
  scene: SceneAsset,
  name: string
): string {
  const actor = [...scene.tree.actors()].find((actor) => actor.name === name);
  assert.ok(actor, `the scene has no "${name}" actor`);

  return actor.id;
}

function mirrored(
  person: ChatPeer
): AgentChatActivity | null {
  return parseAgentChatActivity(person.peerNamed("Builder")?.presence);
}

async function createScene(
  golem: Golem
): Promise<SceneAsset> {
  const assetId = await golem.catalog.create("scenes/level.scene.json", null);

  return golem.open(assetId, "scene");
}

describe("Golem", { timeout: kTimeoutMs }, () => {
  test("edits a scene a peer watches, showing the golem's focus and activity", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    const builder = await createAgentToken(backend, bob, "Builder");
    const watcher = await createAgentToken(backend, bob, "Watcher");
    using golem = await Golem.connect({
      url: backend.url,
      token: builder.value
    });
    const scene = await createScene(golem);
    using peer = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: watcher.value,
      assetId: scene.id,
      documentKind: sceneDocumentKind()
    });

    const sunId = actorNamed(scene, "Sun");
    await scene.apply([
      {
        action: "actor-renamed",
        id: sunId,
        name: "Moon"
      }
    ]);
    golem.activity(scene, {
      label: "Lighting the night",
      progress: 0.5
    });
    await scene.settled();
    await peer.until(() => peer.synced.document.tree.actor(sunId)?.name === "Moon" &&
      peer.peerNamed("Builder")?.presence.activity !== undefined);

    const golemPeer = peer.peerNamed("Builder");
    assert.equal(golemPeer?.profile.via, "golem");
    assert.deepEqual(golemPeer?.presence, {
      [SCENE_SELECTION_PRESENCE_KEY]: sunId,
      activity: {
        label: "Lighting the night",
        progress: 0.5
      }
    });
  });

  test("mirrors its activity on the chat until the asset closes", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, alice, "Builder")).value
    });
    using person = await ChatPeer.join(backend, alice);
    const scene = await createScene(golem);

    golem.activity(scene, {
      label: "Placing trees",
      progress: 0.25
    });
    await person.until(() => mirrored(person) !== null);
    assert.deepEqual(mirrored(person), {
      assetId: scene.id,
      label: "Placing trees",
      progress: 0.25
    });

    golem.close(scene.id);
    await person.until(() => mirrored(person) === null);
  });

  test("refuses to connect with an unknown token", async() => {
    await using backend = await serveStudio();

    await assert.rejects(
      Golem.connect({
        url: backend.url,
        token: "not-a-token"
      }),
      GolemTokenRefusedError
    );
  });

  test("denies an edit its owner's role may not make, before sending it", async() => {
    await using backend = await serveStudio({
      defaultRole: "spectator"
    });
    const alice = await registered(backend, "Alice");
    const bob = await registered(backend, "Bob");
    using aliceGolem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, alice, "Builder")).value
    });
    using bobGolem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Reader")).value
    });
    const created = await createScene(aliceGolem);
    const scene = await bobGolem.open(created.id, "scene");

    await assert.rejects(
      scene.apply([
        {
          action: "actor-renamed",
          id: actorNamed(scene, "Sun"),
          name: "Moon"
        }
      ]),
      CommandDeniedError
    );
    assert.equal(scene.unanswered, 0);
    assert.ok(scene.read().actors.some((actor) => actor.name === "Sun"));
  });

  test("fails edits and a later open once its token is revoked", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    const { token, value } = await createAgentToken(backend, bob, "Builder");
    using golem = await Golem.connect({
      url: backend.url,
      token: value
    });
    const scene = await createScene(golem);
    const sunId = actorNamed(scene, "Sun");
    const unopenedId = await golem.catalog.create("scenes/other.scene.json", null);

    await revokeAgentToken(backend, bob, token.id);

    await assert.rejects(
      async() => {
        await scene.apply([
          {
            action: "actor-renamed",
            id: sunId,
            name: "Moon"
          }
        ]);
        await scene.settled();
      },
      GolemTokenRefusedError
    );
    await assert.rejects(
      golem.open(unopenedId, "scene"),
      GolemTokenRefusedError
    );
  });
});
