// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  MaterialGroupList,
  TilesetAtlases,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockPreviewMesh,
  needsEnvironment,
  PREVIEW_FIT_RADIUS
} from "../../../../src/features/blocks/rendering/blockPreviewMesh.ts";
import {
  blockOf,
  sourcesOf
} from "../../../helpers/blockSources.ts";

// CONSTANTS
const kSources = sourcesOf(new TilesetAtlases());
const kPieces = kSources.createPieces();

function assertFitted(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!;

  assert.ok(Math.abs(sphere.radius - PREVIEW_FIT_RADIUS) < 1e-6);
  assert.ok(sphere.center.length() < 1e-6);
}

describe("needsEnvironment", () => {
  it("is true only for a block drawn with a material group finish", () => {
    const groups = new MaterialGroupList([
      { id: "gold", roughness: 0.3, metalness: 1 }
    ]);

    assert.equal(needsEnvironment(
      buildBlockPreviewMesh(blockOf({ materialGroup: "gold" }), kPieces, groups)
    ), true);
    assert.equal(needsEnvironment(
      buildBlockPreviewMesh(blockOf({}), kPieces, groups)
    ), false);
    assert.equal(needsEnvironment(
      buildBlockPreviewMesh(
        blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] }),
        kPieces
      )
    ), false);
  });
});

describe("buildBlockPreviewMesh", () => {
  it("builds a fitted mesh for every registered shape", () => {
    for (const shapeId of kSources.shapes.ids()) {
      const mesh = buildBlockPreviewMesh(blockOf({ shapeId }), kPieces);

      assert.ok(mesh.geometry.getIndex()!.count > 0, shapeId);
      assert.ok(mesh.geometry.getAttribute("uv"), shapeId);
      assertFitted(mesh.geometry);
    }
  });

  it("builds different geometry for different shapes", () => {
    const cube = buildBlockPreviewMesh(blockOf({ shapeId: "cube" }), kPieces);
    const ramp = buildBlockPreviewMesh(blockOf({ shapeId: "ramp" }), kPieces);

    assert.notDeepEqual(
      cube.geometry.getAttribute("position").array,
      ramp.geometry.getAttribute("position").array
    );
  });

  it("falls back to a grey box for an unknown shape", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] }),
      kPieces
    );
    const material = mesh.material as THREE.MeshLambertMaterial;

    assert.equal(material.color.getHex(), 0xaaaaaa);
    assertFitted(mesh.geometry);
  });

  it("draws a block of a defined material group with its finish", () => {
    const groups = new MaterialGroupList([
      { id: "gold", roughness: 0.3, metalness: 1 }
    ]);

    const gold = buildBlockPreviewMesh(
      blockOf({ materialGroup: "gold" }),
      kPieces,
      groups
    );
    const [textured] = gold.material as THREE.Material[];
    assert.ok(textured instanceof THREE.MeshStandardMaterial);
    assert.equal(textured.metalness, 1);
    assert.equal(textured.roughness, 0.3);

    const plain = buildBlockPreviewMesh(
      blockOf({ materialGroup: "silver" }),
      kPieces,
      groups
    );
    const [lambert] = plain.material as THREE.Material[];
    assert.ok(lambert instanceof THREE.MeshLambertMaterial);
  });

  it("covers the whole index buffer with its groups", () => {
    for (const shapeId of kSources.shapes.ids()) {
      const mesh = buildBlockPreviewMesh(blockOf({ shapeId }), kPieces);
      const { groups } = mesh.geometry;
      const last = groups.at(-1)!;

      assert.equal(groups[0].start, 0, shapeId);
      assert.equal(
        last.start + last.count,
        mesh.geometry.getIndex()!.count,
        shapeId
      );
    }
  });
});
