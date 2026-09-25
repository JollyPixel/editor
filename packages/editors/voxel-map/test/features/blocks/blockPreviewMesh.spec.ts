// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  MaterialGroupList,
  TilesetList,
  TilesetManager,
  VoxelTransform,
  resolveBlockDefinition,
  type BlockDefinition,
  type TilesetImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockGeometry,
  buildBlockPreviewMesh,
  emptyTextureSlots,
  fitGeometry,
  PREVIEW_FIT_RADIUS,
  type BlockPreviewSources
} from "../../../src/features/blocks/blockPreviewMesh.ts";
import { TileOpacityProbe } from "../../../src/features/blocks/tileOpacity.ts";

// CONSTANTS
const kCubeSlots = ["right", "left", "top", "bottom", "front", "back"];
const kSources = sourcesOf(new TilesetManager());
const kTextured = texturedSources();
const kPainted = {
  tilesetId: "atlas",
  col: 0,
  row: 0
};
const kBlank = {
  tilesetId: "atlas",
  col: 1,
  row: 0
};

function sourcesOf(
  tilesetManager: TilesetManager
): BlockPreviewSources {
  return {
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    tileOpacity: new TileOpacityProbe(tilesetManager, () => {
      const data = new Uint8ClampedArray(4 * 2 * 4);
      for (let index = 0; index < data.length; index += 4) {
        data[index + 3] = (index / 4) % 4 < 2 ? 255 : 0;
      }

      return {
        width: 4,
        height: 2,
        data
      };
    })
  };
}

function texturedSources(): BlockPreviewSources {
  const tilesetManager = new TilesetManager({
    tilesets: new TilesetList([
      {
        id: "atlas",
        src: "atlas.png",
        tileSize: 2
      }
    ])
  });
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 2;
  tilesetManager.registerTexture(
    "atlas",
    new THREE.Texture<TilesetImage>(canvas)
  );

  return sourcesOf(tilesetManager);
}

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

describe("buildBlockGeometry", () => {
  it("keeps the geometry in block space", () => {
    const geometry = buildBlockGeometry(blockOf({ shapeId: "ramp" }), kSources)!;
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;

    assert.deepEqual(min.toArray(), [0, 0, 0]);
    assert.deepEqual(max.toArray(), [1, 1, 1]);
  });

  it("orients the geometry with the given transform", () => {
    const block = blockOf({ shapeId: "ramp" });
    const identity = buildBlockGeometry(block, kSources)!;
    const turned = buildBlockGeometry(
      block,
      kSources,
      new VoxelTransform({ rotation: 1 })
    )!;

    assert.notDeepEqual(
      turned.getAttribute("position").array,
      identity.getAttribute("position").array
    );
    assert.deepEqual(turned.groups, identity.groups);
  });

  it("returns null for an unknown shape", () => {
    assert.equal(
      buildBlockGeometry(blockOf({ shapeId: "missing" }), kSources),
      null
    );
  });
});

describe("emptyTextureSlots", () => {
  it("lists every slot of an untextured block", () => {
    assert.deepEqual(emptyTextureSlots(blockOf({}), kTextured), kCubeSlots);
  });

  it("lists nothing for a painted block", () => {
    assert.deepEqual(
      emptyTextureSlots(blockOf({ defaultTexture: kPainted }), kTextured),
      []
    );
  });

  it("lists only the slots mapped to a blank tile", () => {
    const block = blockOf({
      defaultTexture: kPainted,
      faceTextures: { top: kBlank, bottom: kBlank }
    });

    assert.deepEqual(emptyTextureSlots(block, kTextured), ["top", "bottom"]);
  });

  it("lists nothing for an unknown shape", () => {
    assert.deepEqual(
      emptyTextureSlots(
        blockOf({ shapeId: "unknown" as BlockDefinition["shapeId"] }),
        kSources
      ),
      []
    );
  });
});

