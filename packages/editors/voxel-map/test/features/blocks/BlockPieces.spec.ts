// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  VoxelTransform,
  type TilesetImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockPieces } from "../../../src/features/blocks/BlockPieces.ts";
import {
  blockOf,
  texturedSources
} from "../../helpers/blockSources.ts";

describe("BlockPieces", () => {
  it("rebuilds a cached piece once the atlases change", () => {
    const sources = texturedSources();
    const pieces = new BlockPieces(sources);
    const block = blockOf({ defaultTexture: { tilesetId: "atlas", col: 0, row: 0 } });

    const before = pieces.pieceOf(block, VoxelTransform.Identity);
    assert.equal(pieces.pieceOf(block, VoxelTransform.Identity), before);

    const texture = new THREE.Texture<TilesetImage>(document.createElement("canvas"));
    sources.atlases.registerTexture("atlas", texture);
    const after = pieces.pieceOf(block, VoxelTransform.Identity);

    assert.notEqual(after, before);
    assert.equal(after?.texture, texture);
  });
});
