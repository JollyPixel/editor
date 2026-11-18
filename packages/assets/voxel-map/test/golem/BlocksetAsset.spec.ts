// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { blocksetAssetKind } from "#src/index.ts";
import { golemStudio } from "../helpers/golem.ts";

describe("BlocksetAsset", () => {
  test("defines a block and paints its tile in one batch", async() => {
    const studio = golemStudio();
    const { id } = studio.host("blocksets/rocks.blockset.json", blocksetAssetKind());
    const blockset = await studio.open(id, "blockset");
    const { tileSize } = blockset.read();

    await blockset.apply([
      {
        action: "block-defined",
        block: {
          id: 1,
          name: "stone",
          shapeId: "cube",
          faceTextures: {
            top: [1, 0]
          },
          defaultTexture: [0, 0],
          collidable: true,
          properties: {}
        }
      },
      {
        action: "stroke",
        metadata: {
          color: {
            r: 255,
            g: 0,
            b: 0,
            a: 255
          },
          positions: [{ x: tileSize, y: 0 }]
        }
      }
    ]);
    await blockset.pixels.fillRect({
      x: 0,
      y: 0,
      width: tileSize,
      height: tileSize,
      color: "#808080"
    });
    await blockset.settled();

    assert.deepEqual(
      blockset.pixels.readPixels({ x: tileSize - 1, y: 0, width: 2, height: 1 }).rows,
      [["#808080ff", "#ff0000ff"]]
    );
    assert.deepEqual(blockset.blocks(), [
      {
        id: 1,
        name: "stone",
        shapeId: "cube",
        tiles: {
          default: {
            x: 0,
            y: 0,
            width: tileSize,
            height: tileSize
          },
          top: {
            x: tileSize,
            y: 0,
            width: tileSize,
            height: tileSize
          }
        }
      }
    ]);
  });
});
