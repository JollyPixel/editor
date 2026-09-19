// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type { ModelCommand } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { TransformGizmo } from "#src/scene/TransformGizmo.ts";
import { ModelBlocks } from "#src/model/index.ts";
import {
  TransformLiveSync,
  TransformLock
} from "#src/collaboration/index.ts";
import { createRoomHarness } from "../collaboration/roomHarness.ts";

function createHarness() {
  const room = createRoomHarness();
  const scene = new THREE.Scene();
  const blocks = new ModelBlocks(scene);
  const camera = {
    threeCamera: new THREE.PerspectiveCamera(),
    enabled: true
  } as unknown as OrbitFlyCamera;
  const gizmo = new TransformGizmo({
    camera,
    canvas: document.createElement("canvas"),
    scene,
    blocks,
    lock: new TransformLock({ room: room.room }),
    live: new TransformLiveSync({ room: room.room, blocks })
  });

  return { ...room, camera, blocks, gizmo };
}

function dragTo(
  gizmo: TransformGizmo,
  value: boolean
): void {
  gizmo.controls.dispatchEvent({ type: "dragging-changed", value });
}

describe("TransformGizmo", () => {
  test("attaches to the selected block's target once configured", () => {
    const { blocks, gizmo } = createHarness();
    const block = blocks.add();
    blocks.select(block);

    gizmo.configure({ mode: "rotate", target: "pivot" });

    assert.equal(gizmo.controls.enabled, true);
    assert.equal(gizmo.controls.object, block.pivot);
    assert.equal(gizmo.controls.getHelper().visible, true);
  });

  test("follows the selection, detaching when it clears", () => {
    const { blocks, gizmo } = createHarness();
    const first = blocks.add();
    const second = blocks.add();
    gizmo.configure({ mode: "translate", target: "group" });

    blocks.select(first);
    blocks.select(second);
    assert.equal(gizmo.controls.object, second.root);

    blocks.select(null);
    assert.equal(gizmo.controls.object, undefined);
    assert.equal(gizmo.controls.enabled, false);
  });

  test("refuses to attach while a peer holds the transform lock", () => {
    const harness = createHarness();
    const block = harness.blocks.add();
    harness.blocks.select(block);
    harness.gizmo.configure({ mode: "translate", target: "group" });

    harness.addPeer("bob", { presence: { transformLock: block.uuid } });
    harness.emit("sync");

    assert.equal(harness.gizmo.controls.enabled, false);
    assert.equal(harness.gizmo.controls.getHelper().visible, false);
  });

  test("claims the lock on drag start, then commits, clears and releases on drag end", () => {
    const harness = createHarness();
    const block = harness.blocks.add();
    harness.blocks.select(block);
    const commands: ModelCommand[] = [];
    harness.blocks.on("command", (command) => commands.push(command));

    dragTo(harness.gizmo, true);
    assert.equal(harness.gizmo.dragging, true);
    assert.equal(harness.camera.enabled, false);
    assert.deepEqual(harness.published.at(-1), { transformLock: block.uuid });

    dragTo(harness.gizmo, false);
    assert.equal(harness.camera.enabled, true);
    assert.deepEqual(commands.map((command) => command.action), ["group-transformed"]);
    assert.deepEqual(harness.published.slice(-2), [
      { transformLive: null },
      { transformLock: null }
    ]);
  });

  test("reports a change for each gizmo edit of the selected block", () => {
    const { blocks, gizmo } = createHarness();
    const block = blocks.add();
    blocks.select(block);
    const changed: unknown[] = [];
    gizmo.on("change", (target) => changed.push(target));

    gizmo.controls.dispatchEvent({ type: "objectChange" });

    assert.deepEqual(changed, [block]);
  });
});
