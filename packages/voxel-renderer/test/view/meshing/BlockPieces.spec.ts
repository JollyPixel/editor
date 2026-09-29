// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BLOCK_PIECE_EMPTY_GROUP,
  BLOCK_PIECE_TEXTURED_GROUP,
  BlockPieces
} from "../../../src/view/meshing/BlockPieces.ts";
import { TilesetAtlases } from "../../../src/view/atlases/index.ts";
import {
  BlockShapeRegistry,
  buildShapeGeometry,
  resolveBlockDefinition,
  type BlockDefinition
} from "../../../src/document/blocks/index.ts";
import { VoxelTransform } from "../../../src/document/geometry/index.ts";
import {
  rotateTileUv,
  TilesetList
} from "../../../src/document/tilesets/index.ts";
import { makeAtlasDef, registerAtlas } from "../../helpers/atlas.ts";
import { mockTexture } from "../../helpers/mockTexture.ts";

function blockOf(
  patch: Partial<BlockDefinition> = {}
) {
  return resolveBlockDefinition({
    id: 1,
    name: "Block",
    shapeId: "cube",
    ...patch
  });
}

function setup(
  emptyTile?: ConstructorParameters<typeof BlockPieces>[0]["emptyTile"]
) {
  const atlases = new TilesetAtlases({ tilesets: new TilesetList() });
  const atlas = registerAtlas(atlases, makeAtlasDef());
  const pieces = new BlockPieces({
    shapes: BlockShapeRegistry.createDefault(),
    atlases,
    ...emptyTile === undefined ? {} : { emptyTile }
  });

  return { atlases, atlas, pieces };
}

function uvsOf(
  pieces: BlockPieces,
  block: ReturnType<typeof blockOf>
): number[] {
  return Array.from(pieces.geometryOf(block)!.getAttribute("uv").array);
}

describe("BlockPieces", () => {
  it("keeps the geometry in block space", () => {
    const { pieces } = setup();
    const geometry = pieces.geometryOf(blockOf({ shapeId: "ramp" }))!;
    geometry.computeBoundingBox();

    assert.deepEqual(geometry.boundingBox!.min.toArray(), [0, 0, 0]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(), [1, 1, 1]);
  });

  it("orients the geometry with the given transform", () => {
    const { pieces } = setup();
    const block = blockOf({ shapeId: "ramp" });
    const identity = pieces.geometryOf(block)!;
    const turned = pieces.geometryOf(block, new VoxelTransform({ rotation: 1 }))!;

    assert.notDeepEqual(
      turned.getAttribute("position").array,
      identity.getAttribute("position").array
    );
    assert.deepEqual(turned.groups, identity.groups);
  });

  it("returns no geometry and no empty slot for an unknown shape", () => {
    const { pieces } = setup();
    const block = blockOf({ shapeId: "missing" });

    assert.equal(pieces.geometryOf(block), null);
    assert.equal(pieces.pieceOf(block), null);
    assert.deepEqual(pieces.emptySlotsOf(block), []);
  });

  it("turns the tile inside the face like the chunk mesher", () => {
    const { atlas, pieces } = setup();
    const flat = blockOf({ defaultTexture: { tilesetId: "atlas", col: 1, row: 1 } });
    const turned = blockOf({
      defaultTexture: { tilesetId: "atlas", col: 1, row: 1, rotation: 1 }
    });
    const region = atlas.uvFor(1, 1, undefined, undefined, 1);
    const geometry = pieces.geometryOf(turned)!;
    const { uvs } = buildShapeGeometry(
      BlockShapeRegistry.createDefault().get("cube")!
    );
    const [u, v] = rotateTileUv(uvs[0], uvs[1], 1);

    assert.notDeepEqual(uvsOf(pieces, turned), uvsOf(pieces, flat));
    assert.equal(
      geometry.getAttribute("uv").getX(0),
      Math.fround(region.offsetU + (u * region.scaleU))
    );
    assert.equal(
      geometry.getAttribute("uv").getY(0),
      Math.fround(region.offsetV + (v * region.scaleV))
    );
  });

  it("draws a block of an undeclared tileset with the missing texture", () => {
    const { atlases, pieces } = setup();
    const block = blockOf({ defaultTexture: { tilesetId: "gone", col: 3, row: 3 } });
    const missing = atlases.resolve("gone")!;

    assert.equal(pieces.textureOf(block), missing.texture);
    assert.ok(uvsOf(pieces, block).every((uv) => uv >= 0 && uv <= 1));
  });

  it("puts the slots of an empty tile in the empty group", () => {
    const { pieces } = setup(
      (ref) => ref === undefined || ref.col === 1
    );
    const block = blockOf({
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 },
      faceTextures: {
        top: { tilesetId: "atlas", col: 1, row: 0 }
      }
    });
    const groups = pieces.geometryOf(block)!.groups;

    assert.deepEqual(pieces.emptySlotsOf(block), ["top"]);
    assert.equal(groups[2].materialIndex, BLOCK_PIECE_EMPTY_GROUP);
    assert.ok(groups
      .filter((_, index) => index !== 2)
      .every((group) => group.materialIndex === BLOCK_PIECE_TEXTURED_GROUP));
  });

  it("treats a slot without a tile as empty by default", () => {
    const { pieces } = setup();

    assert.deepEqual(pieces.emptySlotsOf(blockOf()), [
      "right",
      "left",
      "top",
      "bottom",
      "front",
      "back"
    ]);
  });

  it("caches pieces per transform until the atlases change", () => {
    const { atlases, pieces } = setup();
    const block = blockOf({ defaultTexture: { tilesetId: "atlas", col: 0, row: 0 } });

    const before = pieces.pieceOf(block);
    assert.equal(pieces.pieceOf(block, VoxelTransform.Identity), before);
    assert.notEqual(pieces.pieceOf(block, new VoxelTransform({ rotation: 2 })), before);

    const texture = mockTexture();
    atlases.registerTexture("atlas", texture);
    const after = pieces.pieceOf(block);

    assert.notEqual(after, before);
    assert.equal(after?.texture, texture);
  });
});
