// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type { ModelCommand } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  TransformPanelController,
  type TransformMode
} from "#src/features/transform/TransformPanelController.ts";
import { ModelDocument } from "#src/model/index.ts";
import { TransformGizmo } from "#src/scene/TransformGizmo.ts";
import {
  TransformLiveSync,
  TransformLock
} from "#src/collaboration/index.ts";
import { createRoomHarness } from "../../collaboration/roomHarness.ts";

class TestHost implements ReactiveControllerHost {
  readonly updateComplete = Promise.resolve(true);
  updateCount = 0;

  addController(
    _controller: ReactiveController
  ): void {
    void _controller;
  }

  removeController(
    _controller: ReactiveController
  ): void {
    void _controller;
  }

  requestUpdate(): void {
    this.updateCount++;
  }
}

function createHarness() {
  const room = createRoomHarness();
  const scene = new THREE.Scene();
  const document = new ModelDocument(scene);
  const lock = new TransformLock({ room: room.room });
  const gizmo = new TransformGizmo({
    camera: {
      threeCamera: new THREE.PerspectiveCamera(),
      enabled: true
    } as unknown as OrbitFlyCamera,
    canvas: globalThis.document.createElement("canvas"),
    scene,
    blocks: document.blocks,
    lock,
    live: new TransformLiveSync({ room: room.room, blocks: document.blocks })
  });
  const host = new TestHost();
  const controller = new TransformPanelController(host);
  controller.attach({ document, gizmo, lock });

  const parent = document.blocks.add();
  parent.rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0);
  const block = document.blocks.add({ position: new THREE.Vector3(1, 2, 3) });
  document.blocks.reparentLocal(block.uuid, parent.uuid);
  scene.updateMatrixWorld(true);
  document.blocks.select(block);

  const commands: ModelCommand[] = [];
  document.blocks.on("command", (command) => commands.push(command));

  return { ...room, document, gizmo, lock, host, controller, block, commands };
}

describe("TransformPanelController space handling", () => {
  test("reads local values in local space and world values in world space", () => {
    const { controller } = createHarness();

    controller.mode = "angle";
    assert.deepStrictEqual(controller.axisValues, { x: 0, y: 0, z: 0 });

    controller.space = "world";
    assert.deepStrictEqual(controller.axisValues, { x: 0, y: 90, z: 0 });
  });

  test("applies position edits in the active space, then commits", () => {
    const { controller, block, commands } = createHarness();

    controller.mode = "pos";
    controller.space = "world";
    controller.axisValues = { x: 5, y: 0, z: 0 };

    assert.ok(block.worldPosition.distanceTo(new THREE.Vector3(5, 0, 0)) < 1e-6);
    assert.deepEqual(commands.map((command) => command.action), ["group-transformed"]);
  });

  test("applies size edits through resize", () => {
    const { controller, block } = createHarness();

    controller.mode = "size";
    controller.axisValues = { x: 2, y: 3, z: 4 };

    assert.deepStrictEqual(block.size, new THREE.Vector3(2, 3, 4));
  });

  test("configures the gizmo for the active mode", () => {
    const { controller, gizmo, block } = createHarness();

    controller.mode = "scale";
    assert.equal(gizmo.controls.object, block.mesh);

    controller.mode = "size";
    assert.equal(gizmo.controls.enabled, false);
  });
});

describe("TransformPanelController refresh", () => {
  test("re-reads the values after a gizmo edit or a committed transform", () => {
    const { controller, document, gizmo, block } = createHarness();
    controller.mode = "pos";

    block.position = new THREE.Vector3(7, 0, 0);
    gizmo.controls.dispatchEvent({ type: "objectChange" });
    assert.equal(controller.axisValues.x, 7);

    document.apply({
      action: "group-transformed",
      uuid: block.uuid,
      transform: {
        ...block.transform,
        position: { x: 8, y: 0, z: 0 }
      }
    });
    assert.equal(controller.axisValues.x, 8);
  });
});

describe("TransformPanelController pivot marker visibility", () => {
  const kVisibleModes: TransformMode[] = ["pos", "angle", "size", "pivot"];

  for (const mode of kVisibleModes) {
    test(`shows the pivot marker in ${mode} mode`, () => {
      const { controller, block } = createHarness();

      controller.mode = mode;

      assert.equal(block.pivotMarkerVisible, true);
    });
  }

  test("hides the pivot marker in scale mode, and on the previous selection", () => {
    const { controller, document, block } = createHarness();

    controller.mode = "scale";
    assert.equal(block.pivotMarkerVisible, false);

    controller.mode = "pos";
    document.blocks.select(null);
    assert.equal(block.pivotMarkerVisible, false);
  });
});

describe("TransformPanelController transform lock", () => {
  test("is disabled with no selection or while a peer holds the lock", () => {
    const harness = createHarness();
    assert.equal(harness.controller.disabled, false);

    harness.addPeer("bob", { presence: { transformLock: harness.block.uuid } });
    harness.emit("sync");
    assert.equal(harness.controller.disabled, true);

    harness.document.blocks.select(null);
    assert.equal(harness.controller.disabled, true);
  });

  test("does not mutate the block when locked, even if asked to", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { transformLock: harness.block.uuid } });
    harness.emit("sync");

    harness.controller.mode = "pos";
    harness.controller.axisValues = { x: 9, y: 9, z: 9 };

    assert.deepStrictEqual(harness.block.position, new THREE.Vector3(1, 2, 3));
    assert.deepEqual(harness.commands, []);
  });

  test("requests an update when the lock changes", () => {
    const harness = createHarness();
    const before = harness.host.updateCount;

    harness.addPeer("bob", { presence: { transformLock: "other" } });
    harness.emit("sync");

    assert.ok(harness.host.updateCount > before);
  });
});
