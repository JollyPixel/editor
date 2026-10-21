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
import { SchemaParser } from "@jolly-pixel/network";
import { decodePngPixels, NormalMapConfig } from "@jolly-pixel/pixel-draw.renderer";
import { PIXEL_COMMAND_ACTIONS } from "@jolly-pixel/asset.pixel-art/client";
import { BLOCKSET_DOCUMENT_COMMAND_ACTIONS } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createBlocksetFile,
  encodeBlocksetFile,
  BLOCKSET_COMMAND,
  BLOCKSET_KIND,
  blocksetAssetKind,
  type BlocksetFile
} from "#src/index.ts";
import {
  blocksetSnapshotSchema,
  type BlocksetNetworkCommand,
  type BlocksetSnapshot
} from "#src/network/server.ts";
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
  test("a delete drops the normal map", () => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));
    state.pixels.apply({
      action: "normal-map-toggled",
      metadata: { config: NormalMapConfig.create().toJSON() }
    });

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "textures/stone.blockset.json",
      kind: BLOCKSET_KIND
    }));

    assert.equal(state.pixels.normalMap, null);
  });

  test("declares the pixel and blockset document command stream", () => {
    const { commands } = blocksetAssetKind();

    assert.strictEqual(commands!.eventType, BLOCKSET_COMMAND);
    assert.deepEqual(commands!.protocol.events.toSorted(), [
      ...PIXEL_COMMAND_ACTIONS,
      ...BLOCKSET_DOCUMENT_COMMAND_ACTIONS
    ].toSorted());
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));

    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, {
      ...kHeader,
      action: "block-defined",
      block: { id: "3" }
    }));
    foldAssetEvent(handler, state, event(BLOCKSET_COMMAND, null));

    assert.equal(state.document.blocks.has(3), false);
  });

  test("live() encodes the snapshot pixels as a PNG", async() => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: BLOCKSET_KIND,
      roomId: `${BLOCKSET_KIND}:asset-1`,
      state
    });
    const parser = new SchemaParser(blocksetSnapshotSchema);

    const encoded = await protocol.encodeSnapshot!() as BlocksetSnapshot;
    const { pixels, ...encodedFields } = encoded;
    const { pixels: plainPixels, ...plainFields } =
      protocol.snapshot() as BlocksetSnapshot;

    assert.strictEqual(parser.parse(encoded).ok, true);
    assert.deepEqual(encodedFields, plainFields);
    assert.ok(typeof pixels.pixels !== "string");
    assert.deepEqual(
      [...await decodePngPixels(pixels.pixels, pixels.size)],
      [...state.pixels.buffer.pixels()]
    );
    assert.deepEqual(pixels.size, plainPixels.size);
  });

  test("live() snapshots the pixels next to the document", () => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, fileEvent(seeded()));
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: BLOCKSET_KIND,
      roomId: `${BLOCKSET_KIND}:asset-1`,
      state
    });

    const snapshot = protocol.snapshot() as Record<string, unknown>;

    assert.deepEqual(Object.keys(snapshot).toSorted(), [
      "blendGroups",
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
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: BLOCKSET_KIND,
      roomId: `${BLOCKSET_KIND}:asset-1`,
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

  test("live() corrects a rejected stroke in place and defers block commands to a snapshot", () => {
    const handler = blocksetAssetKind();
    const state = handler.create("asset-1");
    const protocol = handler.commands!.live!({
      assetId: "asset-1",
      kind: BLOCKSET_KIND,
      roomId: `${BLOCKSET_KIND}:asset-1`,
      state
    });

    const correction = protocol.correct!(strokeCommand(), null);

    assert.strictEqual(correction?.action, "select-edit");
    assert.deepEqual(correction.metadata, {
      xy: [1, 1],
      rgba: [...state.pixels.buffer.samplePixel(1, 1)]
    });
    assert.strictEqual(protocol.correct!(blockCommand(3), null), null);
  });
});
