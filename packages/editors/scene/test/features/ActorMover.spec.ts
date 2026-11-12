// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import { Preferences } from "@jolly-pixel/preferences";
import type { SceneTransformPatch } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { ActorMover } from "../../src/features/viewport/ActorMover.ts";

interface Box {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  parent?: THREE.Object3D;
}

interface Stage {
  mover: ActorMover;
  camera: { camera: THREE.PerspectiveCamera; enabled: boolean; };
  edits: SceneTransformPatch[];
  commits: [string, SceneTransformPatch][];
  discards: string[];
  aimAt(
    x: number,
    y: number,
    z: number
  ): THREE.Raycaster;
}

function createStage(
  boxes: Box[],
  overrides: Record<string, unknown> = {}
): Stage {
  const scene = new THREE.Scene();
  const objects = new Map<string, THREE.Object3D>();
  const ids = new Map<THREE.Object3D, string>();
  for (const { id, size, position, parent = scene } of boxes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
    mesh.position.set(...position);
    parent.add(mesh);
    if (parent.parent === null && parent !== scene) {
      scene.add(parent);
    }
    objects.set(id, mesh);
    ids.set(mesh, id);
  }
  scene.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const orbit = {
    camera,
    enabled: true
  };
  const stage: Stage = {
    camera: orbit,
    edits: [],
    commits: [],
    discards: [],
    mover: new ActorMover({
      camera: orbit,
      scene,
      binding: {
        actor: (id) => {
          const object = objects.get(id);

          return object === undefined ?
            null :
            { node: { object3D: object } } as never;
        },
        actorEntry: () => null,
        findActorId: (object) => ids.get(object) ?? null,
        worldBounds: (actorIds) => {
          const bounds = new THREE.Box3();
          for (const id of actorIds) {
            bounds.expandByObject(objects.get(id)!);
          }

          return bounds;
        }
      },
      document: {
        on: () => undefined,
        off: () => undefined
      } as never,
      draft: {
        editTransform: (id, patch) => {
          stage.edits.push(patch);
          objects.get(id)!.position.copy(patch.position!);
          scene.updateMatrixWorld(true);
        },
        commitTransform: (id, patch) => {
          stage.commits.push([id, patch]);
        },
        discardTransform: (id) => {
          stage.discards.push(id);
        }
      },
      selection: {
        primary: "crate"
      },
      preferences: new Preferences({
        overrides: [["scene", overrides]]
      }),
      components: {
        actorOrigin: () => "center"
      }
    }),
    aimAt(
      x,
      y,
      z
    ) {
      const raycaster = new THREE.Raycaster();
      raycaster.set(
        camera.position,
        new THREE.Vector3(x, y, z).sub(camera.position).normalize()
      );

      return raycaster;
    }
  };

  return stage;
}

const kCrate: Box = {
  id: "crate",
  size: [2, 2, 2],
  position: [0, 1, 0]
};
const kFloor: Box = {
  id: "floor",
  size: [20, 1, 20],
  position: [0, -0.5, 0]
};
const kTable: Box = {
  id: "table",
  size: [2, 2, 2],
  position: [5, 1, 0]
};
const kFree = {
  rest: false,
  free: true
};

describe("ActorMover", () => {
  test("slides the grabbed actor on the ground, snapped to cell centers", () => {
    const stage = createStage([kCrate, kFloor], { snap: true });

    assert.equal(stage.mover.begin(stage.aimAt(0, 2, 0), "ground"), true);
    assert.equal(stage.camera.enabled, false);
    stage.mover.move(stage.aimAt(3.2, 2, 0.1), {
      rest: false,
      free: false
    });
    stage.mover.end();

    assert.deepEqual(stage.commits, [
      ["crate", { position: { x: 3.5, y: 1, z: 0.5 } }]
    ]);
    assert.equal(stage.camera.enabled, true);
  });

  test("grabs only the primary selection under the pointer", () => {
    const stage = createStage([kCrate, kTable]);

    assert.equal(stage.mover.begin(stage.aimAt(5, 2, 0), "ground"), false);
  });

  test("lifts the actor on the vertical plane facing the camera", () => {
    const stage = createStage([kCrate]);

    stage.mover.begin(stage.aimAt(0, 2, 0), "vertical");
    stage.mover.move(stage.aimAt(0.3, 5, 0), kFree);

    assert.deepEqual(stage.edits.at(-1), {
      position: { x: 0, y: 4, z: 0 }
    });
  });

  test("rests the actor on the surface under the pointer, seen through itself", () => {
    const stage = createStage([kCrate, kFloor, kTable]);

    stage.mover.begin(stage.aimAt(0, 2, 0), "ground");
    stage.mover.move(stage.aimAt(0, 0, -1.5), {
      rest: true,
      free: true
    });
    assert.deepEqual(stage.edits.at(-1), {
      position: { x: 0, y: 1, z: -1.5 }
    });

    stage.mover.move(stage.aimAt(5, 2, 0), {
      rest: true,
      free: true
    });
    assert.deepEqual(stage.edits.at(-1), {
      position: { x: 5, y: 3, z: 0 }
    });
  });

  test("slides on from the rest position once the surface is let go", () => {
    const stage = createStage([kCrate, kFloor, kTable]);

    stage.mover.begin(stage.aimAt(0, 2, 0), "ground");
    stage.mover.move(stage.aimAt(5, 2, 0), {
      rest: true,
      free: true
    });
    const rested = stage.edits.length;
    stage.mover.move(stage.aimAt(5, 2, 0), kFree);
    assert.equal(stage.edits.length, rested);

    stage.mover.move(stage.aimAt(6, 2, 0), kFree);
    const { position } = stage.edits.at(-1)!;
    assert.equal(position!.y, 3);
    assert.ok(position!.x > 5);
  });

  test("discards the preview and frees the camera on cancel", () => {
    const stage = createStage([kCrate]);

    stage.mover.begin(stage.aimAt(0, 2, 0), "ground");
    stage.mover.move(stage.aimAt(2, 2, 0), kFree);
    stage.mover.cancel();

    assert.deepEqual(stage.discards, ["crate"]);
    assert.deepEqual(stage.commits, []);
    assert.equal(stage.camera.enabled, true);
    assert.equal(stage.mover.dragging, false);
  });

  const drops = [
    {
      title: "the surface below, in the parent's space",
      x: 5,
      expected: { x: 5, y: 0, z: 0 }
    },
    {
      title: "the ground plane when nothing lies below",
      x: 15,
      expected: { x: 15, y: -2, z: 0 }
    }
  ];
  for (const { title, x, expected } of drops) {
    test(`drops the actor onto ${title}`, () => {
      const parent = new THREE.Object3D();
      parent.position.set(0, 3, 0);
      const stage = createStage([
        {
          ...kCrate,
          position: [x, 3, 0],
          parent
        },
        kFloor,
        kTable
      ]);

      assert.equal(stage.mover.dropToGround(), true);
      assert.deepEqual(stage.commits, [["crate", { position: expected }]]);
    });
  }
});
