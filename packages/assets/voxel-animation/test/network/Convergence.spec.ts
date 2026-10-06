// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { DocumentSyncClient } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  AnimationDocument,
  voxelAnimationAssetKind,
  type AnimationSet
} from "#src/index.ts";
import { animationWriteKeys } from "#src/network/AnimationCommandKeys.ts";
import type {
  AnimationNetworkCommand,
  AnimationServerMessage
} from "#src/network/types.ts";
import {
  clip,
  key,
  networkCommand
} from "../helpers/clips.ts";
import { LiveRoom } from "../helpers/liveRoom.ts";
import { createMockRoom } from "../helpers/room.ts";

function setup() {
  const server = new LiveRoom<AnimationSet, AnimationNetworkCommand>(
    voxelAnimationAssetKind()
  );
  server.receive("A", networkCommand({ action: "clip-added", clip: clip("walk") }, { clientId: "A" }));
  server.receive("A", networkCommand({ action: "clip-added", clip: clip("run") }, { clientId: "A" }));

  const room = createMockRoom("B");
  const document = new AnimationDocument();
  new DocumentSyncClient(room, { document, keys: animationWriteKeys });

  function deliver(): void {
    for (const message of server.take("B")) {
      room.deliver(message as AnimationServerMessage);
    }
  }

  server.connect("B");
  deliver();

  return {
    server,
    document,
    deliver,
    flush(): void {
      for (const sent of room.sent.splice(0)) {
        server.receive("B", sent);
      }
    }
  };
}

describe("voxel-animation convergence", () => {
  test("a client starts from the room snapshot", () => {
    const { document } = setup();

    assert.deepEqual([...document.set.clips()].map(({ id }) => id), ["walk", "run"]);
  });

  test("a local key and a peer key on other ticks both land", () => {
    const { server, document, deliver, flush } = setup();

    document.setKey("walk", "arm", "rotation", key(0, 10));
    server.receive("A", networkCommand({
      action: "key-set",
      clipId: "walk",
      path: "arm",
      channel: "rotation",
      key: key(12000, 90)
    }, { clientId: "A" }));
    flush();
    deliver();

    assert.deepEqual(document.set.toJSON(), server.state.toJSON());
    assert.deepEqual(
      document.set.clip("walk")?.tracks[0].rotation?.map(({ tick }) => tick),
      [0, 12000]
    );
  });

  test("a key set in a clip a peer removed meanwhile is dropped everywhere", () => {
    const { server, document, deliver, flush } = setup();

    document.setKey("run", "leg", "position", key(0, 1));
    server.receive("A", networkCommand({ action: "clip-removed", id: "run" }, { clientId: "A" }));
    flush();
    deliver();

    assert.equal(document.set.has("run"), false);
    assert.deepEqual(document.set.toJSON(), server.state.toJSON());
  });

  test("concurrent renames of the rig settle on the same value", () => {
    const { server, document, deliver, flush } = setup();

    document.renameRig("Humanoid");
    server.receive("A", networkCommand({ action: "rig-renamed", rig: "Biped" }, { clientId: "A" }));
    flush();
    deliver();

    assert.equal(document.set.rig, server.state.rig);
  });
});
