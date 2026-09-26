// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData
} from "@jolly-pixel/asset-server/kinds";
import { protocolEvents } from "@jolly-pixel/network";
import { PIXEL_COMMAND_ACTIONS } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import { TILESET_DOCUMENT_COMMAND_ACTIONS } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createTilesetDocument,
  decodeTilesetDocument,
  encodeTilesetDocument,
  TILESET_COMMAND,
  TILESET_EXTENSION,
  TILESET_KIND,
  tilesetAssetKind,
  type TilesetAssetDocument
} from "#src/index.ts";
import type { TilesetNetworkCommand } from "#src/network/server.ts";
import {
  makeBlockDef,
  makeResolvedBlockDef
} from "../../helpers/blocks.ts";

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
  eventData: AssetEventData | TilesetNetworkCommand | unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: TILESET_KIND,
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

function documentEvent(
  document: TilesetAssetDocument
): EventStore.Event {
  const data = encodeTilesetDocument(document);

  return event(ASSET_CREATED, {
    path: "textures/stone.tileset.json",
    kind: TILESET_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

function strokeCommand(
  header: Partial<typeof kHeader> = {}
): TilesetNetworkCommand {
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
): TilesetNetworkCommand {
  return {
    ...kHeader,
    ...header,
    action: "block-defined",
    block: makeResolvedBlockDef(id, "slope")
  };
}

function seeded(): TilesetAssetDocument {
  return createTilesetDocument({
    tileSize: 8,
    size: { x: 16, y: 16 },
    blocks: [makeBlockDef(1, "cube")],
    materialGroups: [{ id: "gold", metalness: 1 }]
  });
}

describe("tilesetAssetKind", () => {
  test("declares its kind and claims .tileset.json paths", () => {
    const handler = tilesetAssetKind();

    assert.strictEqual(handler.kind, TILESET_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [TILESET_EXTENSION]);
    assert.strictEqual(handler.dependencies, undefined);
  });

  test("creates a blank tileset at the configured size", async() => {
    const handler = tilesetAssetKind({
      tileSize: 16,
      defaultSize: { x: 32, y: 16 }
    });
    const document = decodeTilesetDocument(
      await handler.serialize(handler.create("asset-1"))
    );

    assert.equal(document.tileSize, 16);
    assert.deepEqual(document.pixels.size, { x: 32, y: 16 });
    assert.deepEqual(document.blocks, []);
  });

  test("a lifecycle event loads pixels, blocks and material groups", () => {
    const handler = tilesetAssetKind();
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, documentEvent(seeded()));

    assert.deepEqual(state.pixels.size(), { x: 16, y: 16 });
    assert.equal(state.document.tileSize, 8);
    assert.equal(state.document.blocks.get(1)?.shapeId, "cube");
    assert.equal(state.document.materialGroups.get("gold")?.metalness, 1);
  });

  test("a delete resets the tileset to its defaults", () => {
    const handler = tilesetAssetKind({ tileSize: 32 });
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(seeded()));

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "textures/stone.tileset.json",
      kind: TILESET_KIND
    }));

    assert.deepEqual(state.pixels.size(), { x: 256, y: 256 });
    assert.equal(state.document.tileSize, 32);
    assert.equal(state.document.blocks.size, 0);
    assert.equal(state.document.materialGroups.size, 0);
  });

  test("pixel and block commands both fold and survive serialization", async() => {
    const handler = tilesetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(seeded()));

    foldAssetEvent(handler, state, event(TILESET_COMMAND, strokeCommand()));
    foldAssetEvent(handler, state, event(TILESET_COMMAND, blockCommand(3, { seq: 2 })));
    foldAssetEvent(handler, state, event(TILESET_COMMAND, {
      ...kHeader,
      seq: 3,
      action: "tile-size-updated",
      tileSize: 16
    }));

    const document = decodeTilesetDocument(await handler.serialize(state));
    const restored = handler.create("asset-1");
    foldAssetEvent(handler, restored, documentEvent(document));

    assert.deepEqual(restored.pixels.samplePixel(1, 1), [0, 0, 0, 255]);
    assert.equal(restored.document.tileSize, 16);
    assert.deepEqual(
      [...restored.document.blocks].map(({ id, shapeId }) => [id, shapeId]),
      [[1, "cube"], [3, "slope"]]
    );
  });

  test("declares the pixel and tileset document command stream", () => {
    const { commands } = tilesetAssetKind();

    assert.strictEqual(commands!.eventType, TILESET_COMMAND);
    assert.deepEqual(protocolEvents(commands!.protocol).toSorted(), [
      ...PIXEL_COMMAND_ACTIONS,
      ...TILESET_DOCUMENT_COMMAND_ACTIONS
    ].toSorted());
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = tilesetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(seeded()));

    foldAssetEvent(handler, state, event(TILESET_COMMAND, {
      ...kHeader,
      action: "block-defined",
      block: { id: "3" }
    }));
    foldAssetEvent(handler, state, event(TILESET_COMMAND, null));

    assert.equal(state.document.blocks.has(3), false);
  });

  test("live() snapshots the pixels next to the document", () => {
    const handler = tilesetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(seeded()));
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: TILESET_KIND,
      roomId: `${TILESET_KIND}:asset-1`,
      state
    });

    const snapshot = protocol.snapshot() as Record<string, unknown>;

    assert.deepEqual(Object.keys(snapshot).toSorted(), [
      "blocks",
      "materialGroups",
      "pixels",
      "tileSize"
    ]);
    assert.deepEqual(
      (snapshot.pixels as { size: unknown; }).size,
      { x: 16, y: 16 }
    );
  });

  test("live() arbitrates a block collision by timestamp", () => {
    const handler = tilesetAssetKind();
    const state = handler.create("asset-1");
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: TILESET_KIND,
      roomId: `${TILESET_KIND}:asset-1`,
      state
    });

    protocol.arbitrate(blockCommand(3, { timestamp: 2_000 }))!.commit!();

    assert.strictEqual(
      protocol.arbitrate(blockCommand(3, { clientId: "late", timestamp: 1_000 })),
      null
    );
    assert.notStrictEqual(
      protocol.arbitrate(blockCommand(4, { clientId: "late", timestamp: 1_000 })),
      null
    );
  });
});
