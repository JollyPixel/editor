// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { makeBlockDef } from "./helpers/blocks.ts";
import {
  makeEngine,
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "./helpers/engine.ts";

/** The material variants VoxelEngine chunk meshes are built with. */
type ChunkMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshLambertMaterial | THREE.MeshStandardMaterial
>;

describe("VoxelEngine — layer opacity on the material", () => {
  it("renders a fully opaque layer with an opaque material", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const material = (engine.root.children[0] as ChunkMesh).material;
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    // Nothing can be seen through it, so its back faces stay culled.
    assert.equal(material.side, THREE.FrontSide);
  });

  it("carries the layer opacity on the material instead of the geometry", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground", { opacity: 0.5 });
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const mesh = engine.root.children[0] as ChunkMesh;
    assert.equal(mesh.geometry.getAttribute("color"), undefined);
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.opacity, 0.5);
    assert.equal(mesh.material.depthWrite, true);
    // The mesher emits both faces of a voxel, so a second pass over the same
    // quads would only blend them twice.
    assert.equal(mesh.material.side, THREE.FrontSide);
  });

  it("gives transparent blocks their own double-sided mesh on an opaque layer", () => {
    const engine = makeEngine({
      blocks: [
        makeBlockDef(kCubeId, "cube", { name: "Cube" }),
        makeBlockDef(kLeavesId, "cube", { name: "Leaves", transparent: true })
      ]
    });
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: kLeavesId });
    engine.flush();

    const meshes = engine.root.children as ChunkMesh[];
    const solid = meshes.find((mesh) => !mesh.name.endsWith(":cutout"));
    const cutout = meshes.find((mesh) => mesh.name.endsWith(":cutout"));
    assert.equal(meshes.length, 2);
    assert.ok(solid && cutout);
    // Same texture and render queue, opposite sides: the solid pass keeps its
    // back faces culled, the cutout one shows them through its own holes.
    assert.equal(solid.material.map, cutout.material.map);
    assert.equal(solid.material.transparent, false);
    assert.equal(cutout.material.transparent, false);
    assert.equal(solid.material.side, THREE.FrontSide);
    assert.equal(cutout.material.side, THREE.DoubleSide);
  });

  it("keeps an almost-opaque layer out of the opaque material bucket", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground", { opacity: 0.999 });
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const material = (engine.root.children[0] as ChunkMesh).material;
    assert.equal(material.transparent, true);
    assert.ok(material.opacity < 1);
  });

  it("shares one material between layers whose opacities land in one bucket", () => {
    const engine = makeEngine();
    engine.world.addLayer("A", { opacity: 0.5 });
    engine.world.addLayer("B", { opacity: 0.5001 });
    // Distinct positions, otherwise the higher-priority layer wins compositing
    // and the other emits no mesh at all.
    engine.world.setVoxel("A", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.world.setVoxel("B", { position: { x: 8, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const [first, second] = engine.root.children as ChunkMesh[];
    assert.equal(engine.root.children.length, 2);
    assert.equal(first.material, second.material);
  });
});
