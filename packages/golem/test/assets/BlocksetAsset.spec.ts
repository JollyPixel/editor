// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { blocksetDocumentKind } from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("BlocksetAsset", { timeout: 10_000 }, () => {
  test("defines a block and paints its tile in one batch, as a watching person sees", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const blocksetId = await golem.catalog.create("blocksets/rocks.blockset.json", null);
    const blockset = await golem.open(blocksetId, "blockset");
    using person = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: (await createAgentToken(backend, bob, "Watcher")).value,
      assetId: blocksetId,
      documentKind: blocksetDocumentKind()
    });
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
    await blockset.pixels.fillRect(
      { x: 0, y: 0, width: tileSize, height: tileSize },
      "#808080"
    );
    await blockset.settled();
    const { pixels, blockset: seen } = person.synced.document;
    await person.until(() => seen.blocks.get(1) !== undefined &&
      pixels.buffer.samplePixel(tileSize, 0)[0] === 255 &&
      pixels.buffer.samplePixel(0, 0)[0] === 128);

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
