// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  TilesetManager,
  resolveBlockDefinition,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockPreviewMesh,
  createBlockPreviewStage,
  fitGeometry,
  PREVIEW_FIT_RADIUS
} from "../../../src/features/blocks/blockPreviewMesh.ts";

// CONSTANTS
const kSources = {
  shapeRegistry: BlockShapeRegistry.createDefault(),
  tilesetManager: new TilesetManager()
};

function blockOf(
  patch: Partial<BlockDefinition>
) {
  return resolveBlockDefinition({
    id: 1,
    name: "Block",
    shapeId: "cube",
    ...patch
  });
}

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

  it("leaves an empty geometry untouched", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(0), 3)
    );

    assert.doesNotThrow(() => fitGeometry(geometry));
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

  it("renders untextured when the tileset is missing", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({
        defaultTexture: {
          tilesetId: "missing",
          col: 0,
          row: 0
        }
      }),
      kSources
    );
    const material = mesh.material as THREE.MeshLambertMaterial;

    assert.equal(material.map, null);
  });

  it("maps the block surface onto the material", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({ alphaMode: "blend", side: "double" }),
      kSources
    );
    const material = mesh.material as THREE.MeshLambertMaterial;

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, THREE.DoubleSide);
  });
});

describe("createBlockPreviewStage", () => {
  it("returns a lit scene and a camera facing the origin", () => {
    const { scene, camera } = createBlockPreviewStage();

    assert.equal(scene.children.length, 2);
    assert.equal(camera.position.x, 0);
    assert.equal(camera.position.y, 0);
    assert.ok(camera.position.z > 0);
  });
});
