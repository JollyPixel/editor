// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { TilesetImage } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockPreviewMeshes } from "../../../../src/features/blocks/rendering/BlockPreviewMeshes.ts";
import {
  blockOf,
  texturedSources
} from "../../../helpers/blockSources.ts";

describe("BlockPreviewMeshes", () => {
  it("keeps the mesh of an unchanged block and replaces a redefined one", () => {
    const scene = new THREE.Scene();
    const meshes = new BlockPreviewMeshes(scene, texturedSources());
    const kept = blockOf({ id: 1 });
    const redefined = blockOf({ id: 2 });
    meshes.sync([kept, redefined]);
    const [keptMesh, redefinedMesh] = meshes.entries.map((entry) => entry.mesh);

    meshes.sync([kept, blockOf({ id: 2, shapeId: "ramp" })]);

    assert.equal(meshes.entries[0].mesh, keptMesh);
    assert.notEqual(meshes.entries[1].mesh, redefinedMesh);
    assert.equal(scene.children.includes(redefinedMesh), false);
  });

  it("rebuilds every mesh once the atlases change", () => {
    const sources = texturedSources();
    const meshes = new BlockPreviewMeshes(new THREE.Scene(), sources);
    meshes.sync([blockOf({ id: 1 })]);
    const [before] = meshes.entries;

    sources.atlases.registerTexture(
      "atlas",
      new THREE.Texture<TilesetImage>(document.createElement("canvas"))
    );
    meshes.refresh(0);

    assert.notEqual(meshes.entries[0].mesh, before.mesh);
    assert.equal(meshes.entries[0].block, before.block);
  });
});
