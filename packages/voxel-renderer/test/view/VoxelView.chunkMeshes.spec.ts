// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  chunkMeshes,
  makeView,
  placeCube
} from "../helpers/view.ts";

function buildOneChunk(): VoxelView {
  const view = makeView({ layers: ["Ground"] });
  placeCube(view, "Ground", { x: 4, y: 0, z: 0 });
  view.flush();

  return view;
}

describe("VoxelView - chunk meshes", () => {
  it("raycasts a chunk-local mesh", () => {
    const view = buildOneChunk();
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(4.5, 5, 0.5),
      new THREE.Vector3(0, -1, 0)
    );

    const [hit] = raycaster.intersectObject(view.root, true);

    assert.equal(hit.point.y, 1);
    assert.deepEqual(hit.normal?.toArray(), [0, 1, 0]);
  });

  it("places each chunk mesh at its chunk origin", () => {
    const view = makeView({ layers: ["Ground"] });
    view.document.world.getLayer("Ground")!.position = { x: 1, y: 2, z: 3 };
    placeCube(view, "Ground", { x: 10, y: 2, z: 3 });
    view.flush();

    const [mesh] = chunkMeshes(view);

    assert.deepEqual(mesh.position.toArray(), [9, 2, 3]);
  });

  it("disposes an emptied chunk's geometry, and the rest with the view", () => {
    const view = buildOneChunk();
    placeCube(view, "Ground", { x: 8, y: 0, z: 0 });
    view.flush();
    const disposed: string[] = [];
    const [first, second] = [...chunkMeshes(view)]
      .sort((a, b) => a.position.x - b.position.x);
    first.geometry.addEventListener("dispose", () => disposed.push("first"));
    second.geometry.addEventListener("dispose", () => disposed.push("second"));

    view.document.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    view.tick(0);

    assert.deepEqual(disposed, ["first"]);

    view.dispose();

    assert.deepEqual(disposed, ["first", "second"]);
  });
});
