// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelRenderer } from "../../../src/plugins/engine/VoxelRenderer.ts";
import { VoxelDocument } from "../../../src/document/VoxelDocument.ts";
import { makeLogger } from "../../helpers/fakes.ts";

function makeActor(): Actor {
  return {
    components: [],
    componentsRequiringUpdate: [],
    object3D: new THREE.Group(),
    world: {
      logger: makeLogger(),
      sceneManager: {
        scheduleStart: () => void 0,
        cancelStart: () => void 0
      }
    }
  } as unknown as Actor;
}

describe("VoxelRenderer", () => {
  it("runs the view through the actor component lifecycle", (context) => {
    const actor = makeActor();
    actor.object3D.position.set(1, 2, 3);
    const focus = new THREE.Object3D();
    focus.position.set(5, 6, 7);
    focus.updateMatrixWorld(true);

    const renderer = new VoxelRenderer(actor, { focus });
    const init = context.mock.method(renderer.view, "init", () => void 0);
    const tick = context.mock.method(renderer.view, "tick", () => void 0);
    const dispose = context.mock.method(
      renderer.view,
      "dispose",
      () => void 0
    );

    renderer.awake();
    actor.object3D.updateMatrixWorld(true);
    renderer.update(0.25);

    assert.strictEqual(renderer.view.root.parent, actor.object3D);
    assert.strictEqual(init.mock.callCount(), 1);
    assert.deepStrictEqual(tick.mock.calls[0].arguments, [0.25]);
    assert.deepStrictEqual(renderer.view.focus, new THREE.Vector3(4, 4, 4));

    renderer.destroy();

    assert.strictEqual(renderer.view.root.parent, null);
    assert.strictEqual(dispose.mock.callCount(), 1);
    assert.strictEqual(actor.components.includes(renderer), false);
  });

  it("builds and disposes its own document from the document options", (context) => {
    const renderer = new VoxelRenderer(makeActor(), {
      document: { layers: ["Ground"] }
    });
    const dispose = context.mock.method(renderer.document, "dispose");

    assert.ok(renderer.document.world.getLayer("Ground"));
    assert.strictEqual(renderer.view.document, renderer.document);

    renderer.destroy();

    assert.strictEqual(dispose.mock.callCount(), 1);
  });

  it("draws a given document and leaves it to its owner", (context) => {
    const document = new VoxelDocument({ layers: ["Ground"] });
    const dispose = context.mock.method(document, "dispose");
    const renderer = new VoxelRenderer(makeActor(), { document });

    assert.strictEqual(renderer.document, document);
    assert.strictEqual(renderer.view.document, document);

    renderer.destroy();

    assert.strictEqual(dispose.mock.callCount(), 0);
  });
});
