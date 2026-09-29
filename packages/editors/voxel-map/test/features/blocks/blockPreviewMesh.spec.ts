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
  fitGeometry,
  PREVIEW_FIT_RADIUS
} from "../../../src/features/blocks/blockPreviewMesh.ts";
import {
  blockOf,
  sourcesOf
} from "../../helpers/blockSources.ts";

// CONSTANTS
const kSources = sourcesOf(new TilesetAtlases());

function assertFitted(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!;

  assert.ok(Math.abs(sphere.radius - PREVIEW_FIT_RADIUS) < 1e-6);
  assert.ok(sphere.center.length() < 1e-6);
}

describe("fitGeometry", () => {
  it("centers and scales a geometry to the preview radius", () => {
    const geometry = new THREE.BoxGeometry(4, 2, 6);
    geometry.translate(10, -3, 5);
    fitGeometry(geometry);

    assertFitted(geometry);
  });
});

describe("buildBlockPreviewMesh", () => {
  it("builds a fitted mesh for every registered shape", () => {
    for (const shapeId of kSources.shapeRegistry.ids()) {
      const mesh = buildBlockPreviewMesh(blockOf({ shapeId }), kSources);

      assert.ok(mesh.geometry.getIndex()!.count > 0, shapeId);
      assert.ok(mesh.geometry.getAttribute("uv"), shapeId);
      assertFitted(mesh.geometry);
    }
  });

  it("builds different geometry for different shapes", () => {
    const cube = buildBlockPreviewMesh(blockOf({ shapeId: "cube" }), kSources);
    const ramp = buildBlockPreviewMesh(blockOf({ shapeId: "ramp" }), kSources);

    assert.notDeepEqual(
      cube.geometry.getAttribute("position").array,
      ramp.geometry.getAttribute("position").array
    );
  });

  it("falls back to a grey box for an unknown shape", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] }),
      kSources
    );
    const material = mesh.material as THREE.MeshLambertMaterial;

    assert.equal(material.color.getHex(), 0xaaaaaa);
    assertFitted(mesh.geometry);
  });

  it("draws a block of a defined material group with its finish", () => {
    const sources = {
      ...kSources,
      materialGroups: new MaterialGroupList([
        { id: "gold", roughness: 0.3, metalness: 1 }
      ])
    };

    const gold = buildBlockPreviewMesh(blockOf({ materialGroup: "gold" }), sources);
    const [textured] = gold.material as THREE.Material[];
    assert.ok(textured instanceof THREE.MeshStandardMaterial);
    assert.equal(textured.metalness, 1);
    assert.equal(textured.roughness, 0.3);

    const plain = buildBlockPreviewMesh(blockOf({ materialGroup: "silver" }), sources);
    const [lambert] = plain.material as THREE.Material[];
    assert.ok(lambert instanceof THREE.MeshLambertMaterial);
  });

  it("covers the whole index buffer with its groups", () => {
    for (const shapeId of kSources.shapeRegistry.ids()) {
      const mesh = buildBlockPreviewMesh(blockOf({ shapeId }), kSources);
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
