// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData
} from "@jolly-pixel/asset-server";
import { NormalMapConfig } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  createBlocksetFile,
  BLOCKSET_FILE,
  encodeBlocksetFile,
  BLOCKSET_COMMAND,
  BLOCKSET_EXTENSION,
  BLOCKSET_KIND,
  blocksetAssetKind,
  type BlocksetFile
} from "#src/index.ts";
import { type BlocksetNetworkCommand, type BlocksetSnapshot } from "#src/network/server.ts";
import { makeBlockDef, makeResolvedBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kBlack = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

function event(
  eventType: string,
  eventData: AssetEventData | BlocksetNetworkCommand | unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: BLOCKSET_KIND,
    assetId: "asset-1",
    eventType,
    eventData,
    eventVersion: 1,
    actor: {
      type: "user",
      id: "u1"
    },
    createdAt: new Date().toISOString()
  } as EventStore.Event;
}

function fileEvent(
  file: BlocksetFile
): EventStore.Event {
  const data = encodeBlocksetFile(file);

  return event(ASSET_CREATED, {
    path: "textures/stone.blockset.json",
    kind: BLOCKSET_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

function strokeCommand(
  header: Partial<typeof kHeader> = {}
): BlocksetNetworkCommand {
  return {
    ...kHeader,
    ...header,
    action: "stroke",
    metadata: {
      color: kBlack,
      positions: [{ x: 1, y: 1 }]
    }
  };
}

function blockCommand(
  id: number,
  header: Partial<typeof kHeader> = {}
): BlocksetNetworkCommand {
  return {
    ...kHeader,
    ...header,
    action: "block-defined",
    block: makeResolvedBlockDef(id, "slope")
  };
}

function seeded(): BlocksetFile {
  return createBlocksetFile({
    tileSize: 8,
    size: { x: 16, y: 16 },
    blocks: [makeBlockDef(1, "cube")],
    materialGroups: [{ id: "gold", metalness: 1 }]
  });
}

describe("blocksetAssetKind", () => {
  test("declares its kind and claims .blockset.json paths", () => {
    const handler = blocksetAssetKind();

    assert.strictEqual(handler.kind, BLOCKSET_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [BLOCKSET_EXTENSION]);
    assert.strictEqual(handler.dependencies, undefined);
  });

  test("creates a blank blockset at the configured size", async() => {
    const handler = blocksetAssetKind({
      tileSize: 16,
      defaultSize: { x: 32, y: 16 }
    });
    const file = BLOCKSET_FILE.decode(
      await handler.serialize(handler.create("asset-1"))
    );

    assert.equal(file.tileSize, 16);
    assert.deepEqual(file.pixels.size, { x: 32, y: 16 });
    assert.deepEqual(file.blocks, []);
  });

  test("a lifecycle event loads pixels, blocks and material groups", () => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, fileEvent(seeded()));

    assert.deepEqual(state.pixels.buffer.size(), { x: 16, y: 16 });
    assert.equal(state.document.tileSize, 8);
    assert.equal(state.document.blocks.get(1)?.shapeId, "cube");
    assert.equal(state.document.materialGroups.get("gold")?.metalness, 1);
  });

  test("a delete empties the blockset and keeps its sizes", () => {
    const handler = blocksetAssetKind({ tileSize: 32 });
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));
    state.pixels.buffer.drawPixels(
      [{ x: 1, y: 1 }],
      {
        r: 255,
        g: 0,
        b: 0,
        a: 255
      }
    );

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "textures/stone.blockset.json",
      kind: BLOCKSET_KIND
    }));

    assert.deepEqual(state.pixels.buffer.size(), { x: 16, y: 16 });
    assert.deepEqual(
      state.pixels.buffer.pixels(),
      new Uint8ClampedArray(16 * 16 * 4)
    );
    assert.equal(state.document.tileSize, 8);
    assert.equal(state.document.blocks.size, 0);
    assert.equal(state.document.materialGroups.size, 0);
  });

  test("pixel and block commands both fold and survive serialization", async() => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));

    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, strokeCommand()));
    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, blockCommand(3, { seq: 2 })));
    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, {
      ...kHeader,
      seq: 3,
      action: "tile-size-updated",
      tileSize: 16
    }));

    const file = BLOCKSET_FILE.decode(await handler.serialize(state));
    const restored = handler.create("asset-1");
    foldAssetEvent(handler, restored, fileEvent(file));

    assert.deepEqual(restored.pixels.buffer.samplePixel(1, 1), [0, 0, 0, 255]);
    assert.equal(restored.document.tileSize, 16);
    assert.deepEqual(
      [...restored.document.blocks].map(({ id, shapeId }) => [id, shapeId]),
      [[1, "cube"], [3, "slope"]]
    );
  });

  test("normal map commands fold into the pixels and survive serialization", async() => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));

    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, {
      ...kHeader,
      action: "normal-map-toggled",
      metadata: {
        config: NormalMapConfig.create().toJSON()
      }
    }));
    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, {
      ...kHeader,
      seq: 2,
      action: "normal-map-zone-set",
      metadata: {
        zone: { regionId: "block-1", settings: { strength: 4 } },
        index: 0
      }
    }));

    const expected = NormalMapConfig.create()
      .withZone({ regionId: "block-1", settings: { strength: 4 } })
      .toJSON();
    const file = BLOCKSET_FILE.decode(await handler.serialize(state));
    assert.deepEqual(file.pixels.normalMap, expected);

    const restored = handler.create("asset-1");
    foldAssetEvent(handler, restored, fileEvent(file));
    assert.deepEqual(restored.pixels.normalMap?.toJSON(), expected);
  });

  test("live() snapshots carry the normal map settings", async() => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));
    state.pixels.apply({
      action: "normal-map-toggled",
      metadata: { config: NormalMapConfig.create().toJSON() }
    });
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: BLOCKSET_KIND,
      roomId: `${BLOCKSET_KIND}:asset-1`,
      state
    });
    const expected = NormalMapConfig.create().toJSON();

    const snapshot = protocol.snapshot() as BlocksetSnapshot;
    const encoded = await protocol.encodeSnapshot!() as BlocksetSnapshot;

    assert.deepEqual(snapshot.pixels.normalMap, expected);
    assert.deepEqual(encoded.pixels.normalMap, expected);
  });
});
