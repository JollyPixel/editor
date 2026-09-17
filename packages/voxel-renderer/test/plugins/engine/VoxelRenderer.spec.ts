// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelRenderer } from "../../../src/plugins/engine/VoxelRenderer.ts";
import type { VoxelLogger } from "../../../src/utils/logger.ts";

test("VoxelRenderer owns the voxel engine lifecycle", (context) => {
  let childCallCount = 0;
  const logger: VoxelLogger = {
    child() {
      childCallCount++;

      return logger;
    },
    debug() {
      // Intentionally empty.
    },
    warn() {
      // Intentionally empty.
    },
    error() {
      // Intentionally empty.
    }
  };

  const object3D = new THREE.Group();
  object3D.position.set(1, 2, 3);
  const actor = {
    components: [],
    componentsRequiringUpdate: [],
    object3D,
    world: {
      logger,
      sceneManager: {
        componentsToBeStarted: []
      }
    }
  } as unknown as Actor;
  const focus = new THREE.Object3D();
  focus.position.set(5, 6, 7);
  focus.updateMatrixWorld(true);

  const renderer = new VoxelRenderer(actor, { focus });
  const init = context.mock.method(renderer.engine, "init", () => void 0);
  const tick = context.mock.method(renderer.engine, "tick", () => void 0);
  const dispose = context.mock.method(
    renderer.engine,
    "dispose",
    () => void 0
  );

  renderer.awake();
  object3D.updateMatrixWorld(true);
  renderer.update(0.25);

  assert.strictEqual(renderer.engine.root.parent, object3D);
  assert.strictEqual(init.mock.callCount(), 1);
  assert.deepStrictEqual(tick.mock.calls[0].arguments, [0.25]);
  assert.deepStrictEqual(renderer.engine.focus, new THREE.Vector3(4, 4, 4));
  assert.ok(childCallCount > 0);

  renderer.destroy();

  assert.strictEqual(renderer.engine.root.parent, null);
  assert.strictEqual(dispose.mock.callCount(), 1);
  assert.strictEqual(actor.components.includes(renderer), false);
});
