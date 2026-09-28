// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  chunkMeshes,
  makeView,
  placeCube,
  type ViewTestOptions
} from "../helpers/view.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "../helpers/ids.ts";

type ChunkMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

function materialsOf(
  view: VoxelView
): ChunkMaterial[] {
  return chunkMeshes(view).map((mesh) => mesh.material as ChunkMaterial);
}

function meshedGround(
  layerOptions: { opacity?: number; } = {},
  engineOptions: ViewTestOptions = {}
): VoxelView {
  const view = makeView(engineOptions);
  view.document.world.addLayer("Ground", layerOptions);
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });

  return view;
}

describe("VoxelView - layer opacity on the material", () => {
  it("renders a fully opaque layer with an opaque front-sided material", () => {
    const view = meshedGround();
    view.flush();

    const [material] = materialsOf(view);
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("carries the layer opacity on a blended front-sided material", () => {
    const view = meshedGround({ opacity: 0.5 });
    view.flush();

    const [material] = materialsOf(view);
    assert.equal(material.transparent, true);
    assert.equal(material.opacity, 0.5);
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("keeps an almost-opaque layer out of the opaque material bucket", () => {
    const view = meshedGround({ opacity: 0.999 });
    view.flush();

    const [material] = materialsOf(view);
    assert.equal(material.transparent, true);
    assert.ok(material.opacity < 1);
  });

  it("gives transparent blocks their own double-sided mesh on an opaque layer", () => {
    const view = meshedGround({}, {
      blocks: [
        makeBlockDef(kCubeId, "cube"),
        makeBlockDef(kLeavesId, "cube", { alphaMode: "blend" })
      ]
    });
    placeCube(view, "Ground", { x: 2, y: 0, z: 0 }, kLeavesId);
    view.flush();

    const meshes = chunkMeshes(view);
    const solid = meshes.find((mesh) => !mesh.name.includes(":surface="));
    const cutout = meshes.find((mesh) => mesh.name.includes(":surface="));
    assert.equal(meshes.length, 2);
    assert.ok(solid && cutout);

    const solidMaterial = solid.material as ChunkMaterial;
    const cutoutMaterial = cutout.material as ChunkMaterial;
    assert.equal(solidMaterial.map, cutoutMaterial.map);
    assert.equal(solidMaterial.transparent, false);
    assert.equal(cutoutMaterial.transparent, true);
    assert.equal(cutoutMaterial.depthWrite, false);
    assert.equal(solidMaterial.side, THREE.FrontSide);
    assert.equal(cutoutMaterial.side, THREE.DoubleSide);
  });

  it("preserves distinct layer opacities", () => {
    const view = makeView();
    view.document.world.addLayer("A", { opacity: 0.5 });
    view.document.world.addLayer("B", { opacity: 0.5001 });
    placeCube(view, "A", { x: 0, y: 0, z: 0 });
    placeCube(view, "B", { x: 8, y: 0, z: 0 });
    view.flush();

    const [first, second] = materialsOf(view);
    assert.notEqual(first, second);
    assert.deepEqual([first.opacity, second.opacity].sort(), [0.5, 0.5001]);
  });
});

describe("VoxelView - material groups", () => {
  const kGoldId = 5;

  function goldView(
    groups: Array<string | undefined>
  ): VoxelView {
    const view = meshedGround({}, {
      blocks: [
        makeBlockDef(kCubeId, "cube"),
        makeBlockDef(kGoldId, "cube", { materialGroup: groups[1] })
      ],
      rendering: {
        material: "standard",
        customizer(material, _tilesetId, surface) {
          if (
            material instanceof THREE.MeshStandardMaterial &&
            surface.materialGroup === "gold"
          ) {
            material.metalness = 1;
          }
        }
      }
    });
    placeCube(view, "Ground", { x: 2, y: 0, z: 0 }, kGoldId);
    view.flush();

    return view;
  }

  it("gives a grouped block its own customizable material on one atlas", () => {
    const view = goldView([undefined, "gold"]);

    const materials = materialsOf(view) as THREE.MeshStandardMaterial[];
    assert.equal(materials.length, 2);
    assert.deepEqual(
      materials.map((material) => material.metalness).sort(),
      [0, 1]
    );
    assert.equal(materials[0].map, materials[1].map);
  });

  it("shares one material between ungrouped blocks", () => {
    const view = goldView([undefined, undefined]);

    assert.equal(materialsOf(view).length, 1);
  });
});

describe("VoxelView - document material group finishes", () => {
  const kGoldId = 5;

  function lambertGold(): VoxelView {
    const view = meshedGround({}, {
      blocks: [
        makeBlockDef(kCubeId, "cube"),
        makeBlockDef(kGoldId, "cube", { materialGroup: "gold" })
      ]
    });
    placeCube(view, "Ground", { x: 2, y: 0, z: 0 }, kGoldId);
    view.flush();

    return view;
  }

  function goldMaterial(
    view: VoxelView
  ): ChunkMaterial | undefined {
    return materialsOf(view).find(
      (material) => material instanceof THREE.MeshStandardMaterial
    );
  }

  it("rebuilds a lambert view with a standard material for a defined group", () => {
    const view = lambertGold();
    assert.equal(goldMaterial(view), undefined);

    view.document.defineMaterialGroup({ id: "gold", roughness: 0.3, metalness: 1 });
    view.flush();

    const gold = goldMaterial(view);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 1);
    assert.equal(gold.roughness, 0.3);
    assert.equal(materialsOf(view).length, 2);
  });

  it("edits the finish of the drawn material in place", () => {
    const view = lambertGold();
    view.document.defineMaterialGroup({ id: "gold" });
    view.flush();
    const gold = goldMaterial(view);

    view.document.defineMaterialGroup({ id: "gold", emissive: "#ff0000" });

    assert.equal(view.pendingRebuilds, 0);
    assert.equal(goldMaterial(view), gold);
    assert.equal(gold?.emissive.getHexString(), "ff0000");
  });

  it("goes back to the view material when the group is removed", () => {
    const view = lambertGold();
    view.document.defineMaterialGroup({ id: "gold", metalness: 1 });
    view.flush();

    view.document.removeMaterialGroup("gold");
    view.flush();

    assert.equal(goldMaterial(view), undefined);
  });
});

describe("VoxelView - tile minification", () => {
  it("fades distant tiles to their average colour by default", () => {
    assert.equal(meshedGround().rendering.tileMinification, "average");
  });

  it("honours the constructor option", () => {
    const view = meshedGround({}, { rendering: { tileMinification: "nearest" } });

    assert.equal(view.rendering.tileMinification, "nearest");
  });

  it("replaces chunk materials when switched", () => {
    const view = meshedGround();
    view.flush();
    const [before] = materialsOf(view);

    view.rendering.tileMinification = "nearest";
    view.flush();

    assert.equal(view.rendering.tileMinification, "nearest");
    assert.notEqual(materialsOf(view)[0], before);
  });
});
