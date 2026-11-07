// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { foldAssetEvent } from "@jolly-pixel/asset-server";
import type * as EventStore from "@jolly-pixel/event-store";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";
import { encodeBase64 } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  encodeHeightBytes,
  TERRAIN_COMMAND,
  terrainAssetKind
} from "#src/index.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

function legacyStoredCommand(
  command: object
): EventStore.Event {
  const json = JSON.stringify(
    command,
    (_key, value: unknown) => (value instanceof Uint8Array ? encodeBase64(value) : value)
  );

  return {
    eventId: 1,
    assetType: "terrain",
    assetId: "asset",
    eventType: TERRAIN_COMMAND,
    eventData: JSON.parse(json),
    eventVersion: 1,
    actor: { type: "user", id: "u1" },
    createdAt: ""
  };
}

describe("terrain stored commands", () => {
  test("replay folds chunk and patch commands stored with base64 bytes", () => {
    const handler = terrainAssetKind();
    const model = handler.create("asset");
    const tile = encodeHeightBytes(tileHeights(7));

    for (const command of [
      networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(3) }),
      networkCommand({ action: "heights-patched", tiles: [{ x: 1, z: 0, tile: 0, heights: tile }] })
    ]) {
      foldAssetEvent(handler, model, legacyStoredCommand(command));
    }

    const chunk = model.terrain.chunk(new ChunkCoord(1, 0))!;
    assert.deepEqual([chunk.sample(0, 0), chunk.sample(32, 32)], [7, 3]);
  });
});
