// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  TilesetList,
  TilesetManager,
  resolveBlockDefinition,
  type BlockDefinition,
  type TilesetImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockPreviewMesh,
  createBlockPreviewStage,
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

function materialsOf(
  mesh: THREE.Mesh
): THREE.MeshLambertMaterial[] {
  return mesh.material as THREE.MeshLambertMaterial[];
}

function groupMaterials(
  mesh: THREE.Mesh
): number[] {
  return mesh.geometry.groups.map((group) => group.materialIndex!);
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

  it("renders checker faces when the tileset is missing", () => {
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

    assert.equal(materialsOf(mesh)[0].map, null);
    assert.deepEqual(groupMaterials(mesh), kCubeSlots.map(() => 1));
  });

  it("maps the block surface onto the material", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({ alphaMode: "blend", side: "double" }),
      kSources
    );
    const [material] = materialsOf(mesh);

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, THREE.DoubleSide);
  });

  it("textures painted faces without an outline", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({ defaultTexture: kPainted }),
      kTextured
    );

    assert.ok(materialsOf(mesh)[0].map);
    assert.deepEqual(groupMaterials(mesh), kCubeSlots.map(() => 0));
    assert.equal(mesh.children.length, 0);
  });

  it("paints blank faces with the checker and outlines them", () => {
    const mesh = buildBlockPreviewMesh(
      blockOf({
        defaultTexture: kPainted,
        faceTextures: { top: kBlank }
      }),
      kTextured
    );
    const [, checker] = materialsOf(mesh);

    assert.deepEqual(
      groupMaterials(mesh),
      kCubeSlots.map((slot) => (slot === "top" ? 1 : 0))
    );
    assert.ok(checker.map instanceof THREE.DataTexture);
    assert.equal(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof THREE.LineSegments);
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

  it("shares one checker texture across meshes", () => {
    const first = buildBlockPreviewMesh(blockOf({}), kSources);
    const second = buildBlockPreviewMesh(blockOf({}), kSources);

    assert.equal(materialsOf(first)[1].map, materialsOf(second)[1].map);
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

describe("createBlockPreviewStage", () => {
  it("returns a lit scene and a camera facing the origin", () => {
    const { scene, camera } = createBlockPreviewStage();

    assert.equal(scene.children.length, 2);
    assert.equal(camera.position.x, 0);
    assert.equal(camera.position.y, 0);
    assert.ok(camera.position.z > 0);
  });
});
