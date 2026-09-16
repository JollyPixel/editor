// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import { GroupTransformLiveSync } from "../../src/collaboration/GroupTransformLiveSync.ts";
import ModelManager from "../../src/features/groups/ModelManager.ts";
import { createRoomHarness } from "./roomHarness.ts";

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

function createFakeActor(): Actor {
  return {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      sceneManager: {
        componentsToBeStarted: []
      }
    }
  } as unknown as Actor;
}

function createHarness() {
  const room = createRoomHarness();
  const modelManager = createModelManager();
  const sync = new GroupTransformLiveSync(createFakeActor(), {
    room: room.room,
    modelManager
  });

  return { ...room, modelManager, sync };
}

function publishLive(
  harness: ReturnType<typeof createHarness>,
  clientId: string,
  uuid: string,
  x: number
): void {
  harness.emit("peer-presence", {
    clientId,
    patch: {
      transformLive: {
        uuid,
        transform: {
          position: { x, y: 0, z: 0 },
          pivotOffset: { x: 0, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          scale: { x: 1, y: 1, z: 1 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      }
    }
  });
}

describe("GroupTransformLiveSync", () => {
  test("moves the real block to the live position", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);

    assert.equal(group.getPosition().x, 5);
    harness.sync.destroy();
  });

  test("does not revert an explicit clear, since the authoritative commit is imminent", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);
    harness.emit("peer-presence", { clientId: "bob", patch: { transformLive: null } });

    assert.equal(group.getPosition().x, 5);
    harness.sync.destroy();
  });

  test("reverts to the pre-drag baseline once the stream goes silent", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);
    t.mock.timers.tick(4999);
    assert.equal(group.getPosition().x, 5);

    t.mock.timers.tick(1);
    assert.equal(group.getPosition().x, 0);
    harness.sync.destroy();
  });

  test("reverts to the pre-drag baseline when the peer disconnects mid-drag", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);
    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(group.getPosition().x, 0);
    harness.sync.destroy();
  });

  test("shows a peer-colored outline while the stream is live, removed once it ends", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);
    assert.ok(group.getMesh().children.some((child) => child.name === "emphasis-shell"));

    harness.emit("peer-presence", { clientId: "bob", patch: { transformLive: null } });
    assert.ok(!group.getMesh().children.some((child) => child.name === "emphasis-shell"));
    harness.sync.destroy();
  });

  test("leaves the block at its last live position on component teardown", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    publishLive(harness, "bob", group.getGroupUUID(), 5);
    harness.sync.destroy();

    assert.equal(group.getPosition().x, 5);
  });
});
