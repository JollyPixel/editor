// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  BlocksetAtlases,
  MaterialGroupList,
  VoxelTemplate,
  packVoxel
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { PREVIEW_FIT_RADIUS } from "../../../../src/features/preview/stage.ts";
import {
  buildTemplatePreviewMesh
} from "../../../../src/features/templates/rendering/templatePreviewMesh.ts";
import { sourcesOf } from "../../../helpers/blockSources.ts";

// CONSTANTS
const kPlain = 1;
const kGold = 2;
const kUnknown = 9;

function sourcesFor() {
  return {
    pieces: sourcesOf(new BlocksetAtlases()).createPieces(),
    blockRegistry: new BlockRegistry([
      {
        id: kPlain,
        name: "Plain",
        shapeId: "cube"
      },
      {
        id: kGold,
        name: "Gold",
        shapeId: "cube",
        materialGroup: "gold"
      }
    ]),
    materialGroups: new MaterialGroupList([
      { id: "gold", roughness: 0.3, metalness: 1 }
    ])
  };
}

function templateOf(
  blockIds: number[]
): VoxelTemplate {
  return new VoxelTemplate({
    id: "row",
    name: "Row",
    positions: blockIds.flatMap((_, index) => [index * 3, 0, 0]),
    voxels: blockIds.map((blockId) => packVoxel(blockId, 0))
  });
}

describe("buildTemplatePreviewMesh", () => {
  it("draws material group blocks with their finish beside plain blocks", () => {
    const mesh = buildTemplatePreviewMesh(
      templateOf([kPlain, kGold, kPlain]),
      sourcesFor()
    );

    assert.ok(mesh !== null);
    assert.deepEqual(
      [mesh.material].flat().map((material) => material.type).sort(),
      ["MeshLambertMaterial", "MeshStandardMaterial"]
    );
  });

  it("fits the whole template inside the preview radius", () => {
    const mesh = buildTemplatePreviewMesh(
      templateOf([kPlain, kPlain, kPlain]),
      sourcesFor()
    );

    assert.ok(mesh !== null);
    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere!;
    assert.ok(Math.abs(sphere.radius - PREVIEW_FIT_RADIUS) < 1e-6);
    assert.ok(sphere.center.length() < 1e-6);
  });

  it("draws nothing when no voxel resolves to a block", () => {
    assert.equal(
      buildTemplatePreviewMesh(templateOf([kUnknown]), sourcesFor()),
      null
    );
  });
});
