// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import type { PulledChunkGeometry } from "../../src/view/meshing/index.ts";
import {
  chunkCoordsOf,
  chunkMeshes,
  makeView,
  placeCube
} from "../helpers/view.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { CUBE_ID } from "../helpers/ids.ts";

// CONSTANTS
const kGlowId = 7;

function glowingView(
  lightLevel = 15
): VoxelView {
  const view = makeView({
    layers: ["Ground"],
    blocks: [
      makeBlockDef(CUBE_ID, "cube"),
      makeBlockDef(kGlowId, "cube", { materialGroup: "glow" })
    ],
    materialGroups: [{ id: "glow", lightLevel }]
  });
  placeCube(view, "Ground", { x: 1, y: 0, z: 1 }, kGlowId);
  placeCube(view, "Ground", { x: 12, y: 0, z: 1 });
  placeCube(view, "Ground", { x: 40, y: 0, z: 1 });
  view.flush();

  return view;
}

function resolveLightTexture(
  view: VoxelView,
  coords: string
): THREE.Texture | null {
  const mesh = chunkMeshes(view).find(
    (candidate) => chunkCoordsOf(candidate) === coords
  );
  assert.ok(mesh, `chunk ${coords} must be meshed`);

  return (mesh.geometry as PulledChunkGeometry).light;
}

describe("VoxelView - block light", () => {
  it("binds a light texture to the chunks a glowing block reaches", () => {
    const view = glowingView();

    assert.ok(resolveLightTexture(view, "0,0,0") instanceof THREE.Data3DTexture);
    assert.ok(resolveLightTexture(view, "3,0,0") instanceof THREE.Data3DTexture);
    assert.equal(resolveLightTexture(view, "10,0,0"), null);
  });

  it("lights nothing while the group has no light level", () => {
    const view = glowingView(0);

    assert.equal(resolveLightTexture(view, "0,0,0"), null);
  });

  it("darkens a distant chunk without rebuilding it", () => {
    const view = glowingView();
    const [distant] = chunkMeshes(view).filter(
      (mesh) => chunkCoordsOf(mesh) === "3,0,0"
    );

    view.document.world.removeVoxel("Ground", { position: { x: 1, y: 0, z: 1 } });
    view.tick(0);

    assert.ok(chunkMeshes(view).includes(distant));
    assert.equal(resolveLightTexture(view, "3,0,0"), null);
  });

  it("relights when a material group gains a light level", () => {
    const view = glowingView(0);

    view.document.defineMaterialGroup({ id: "glow", lightLevel: 9 });
    view.flush();

    assert.ok(resolveLightTexture(view, "0,0,0") instanceof THREE.Data3DTexture);
  });

  it("drives the shared strength and keeps it non-negative", () => {
    const view = makeView({ lighting: { blockLight: 2 } });
    assert.equal(view.lighting.blockLight, 2);

    view.lighting.blockLight = -1;

    assert.equal(view.lighting.blockLight, 0);
  });

  it("relights with a new falloff and keeps the strength the caller set", () => {
    const view = glowingView();
    const wide = [...(resolveLightTexture(view, "0,0,0") as THREE.Data3DTexture).image.data!];

    view.lighting.blockLight = 2;
    view.lighting.blockLightFalloff = "focused";
    view.tick(0);

    const focused = (resolveLightTexture(view, "0,0,0") as THREE.Data3DTexture).image.data!;
    assert.equal(view.lighting.blockLightFalloff, "focused");
    assert.equal(view.lighting.blockLight, 2);
    assert.notDeepEqual([...focused], wide);
  });

  it("leaves the light untouched while the strength is 0", () => {
    const view = glowingView();
    view.lighting.blockLight = 0;

    view.document.world.removeVoxel("Ground", { position: { x: 1, y: 0, z: 1 } });
    view.tick(0);
    assert.ok(resolveLightTexture(view, "3,0,0") instanceof THREE.Data3DTexture);

    view.lighting.blockLight = 1;
    view.tick(0);
    assert.equal(resolveLightTexture(view, "3,0,0"), null);
  });

  it("keeps the shadow fill non-negative", () => {
    const view = makeView({ lighting: { shadowFill: 1.5 } });
    assert.equal(view.lighting.shadowFill, 1.5);

    view.lighting.shadowFill = -1;

    assert.equal(view.lighting.shadowFill, 0);
  });

  it("gives every chunk material an emissive node", () => {
    const view = glowingView();

    for (const mesh of chunkMeshes(view)) {
      assert.ok(
        (mesh.material as { emissiveNode?: unknown; }).emissiveNode,
        `${mesh.name} must have an emissive node`
      );
    }
  });
});
