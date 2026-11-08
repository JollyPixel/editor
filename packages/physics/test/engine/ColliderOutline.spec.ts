// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ColliderShape } from "#src/ColliderShape.ts";
import { ColliderOutline } from "#src/engine/ColliderOutline.ts";
import {
  RIGID_BODY_DEFAULTS,
  COLLIDER_SETTINGS_DEFAULTS
} from "#src/engine/RigidBody.ts";
import { createEngineWorld } from "../helpers/engineWorld.ts";

interface ShapeCase {
  shape: ColliderShape;
  halfSize: THREE.Vector3Tuple;
}

// CONSTANTS
const kStretchedY: THREE.Vector3Tuple = [1, 2, 1];
const kShapeCases: Record<string, ShapeCase> = {
  box: {
    shape: {
      type: "box",
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 }
    },
    halfSize: [0.5, 1, 0.5]
  },
  sphere: {
    shape: {
      type: "sphere",
      radius: 0.5
    },
    halfSize: [1, 1, 1]
  },
  capsule: {
    shape: {
      type: "capsule",
      halfHeight: 0.5,
      radius: 0.5
    },
    halfSize: [0.5, 1.5, 0.5]
  }
};

function outlineActor(
  shape: ColliderShape,
  scale: THREE.Vector3Tuple
) {
  const world = createEngineWorld();
  const actor = world.createActor("collider");
  actor.transform.setLocalPosition(new THREE.Vector3(3, 0, 0));
  actor.transform.setLocalScale(new THREE.Vector3(...scale));
  const outline = actor.addComponentAndGet(ColliderOutline, {
    ...RIGID_BODY_DEFAULTS,
    colliders: [
      {
        ...COLLIDER_SETTINGS_DEFAULTS,
        shape,
        offset: { x: 0, y: 1, z: 0 }
      }
    ]
  });

  return { actor, outline };
}

function worldBounds(
  object: THREE.Object3D
): THREE.Box3 {
  object.updateWorldMatrix(true, true);

  return new THREE.Box3().setFromObject(object);
}

function assertBounds(
  bounds: THREE.Box3,
  center: THREE.Vector3Tuple,
  halfSize: THREE.Vector3Tuple
): void {
  const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const middle = bounds.getCenter(new THREE.Vector3());
  for (const [index, axis] of (["x", "y", "z"] as const).entries()) {
    assert.ok(Math.abs(middle[axis] - center[index]) < 1e-6, `center ${axis}`);
    assert.ok(Math.abs(size[axis] - halfSize[index]) < 1e-6, `size ${axis}`);
  }
}

describe("ColliderOutline", () => {
  for (const [name, { shape, halfSize }] of Object.entries(kShapeCases)) {
    it(`outlines a ${name} at the size the body gets on a stretched actor`, () => {
      const { actor } = outlineActor(shape, kStretchedY);

      assertBounds(worldBounds(actor.node.object3D), [3, 2, 0], halfSize);
    });
  }

  it("redraws when the actor scale changes", () => {
    const { actor, outline } = outlineActor(kShapeCases.sphere.shape, [1, 1, 1]);

    actor.transform.setLocalScale(new THREE.Vector3(3, 1, 1));
    outline.update();

    assertBounds(worldBounds(actor.node.object3D), [3, 1, 0], [1.5, 1.5, 1.5]);
  });

  it("removes its lines from the actor when destroyed", () => {
    const { actor, outline } = outlineActor(kShapeCases.box.shape, [1, 1, 1]);

    outline.destroy();

    assert.equal(worldBounds(actor.node.object3D).isEmpty(), true);
  });
});
