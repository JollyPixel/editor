// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type AssetLiveProtocol, type AssetRoomBinding } from "@jolly-pixel/asset-server";
import { SchemaParser } from "@jolly-pixel/network";
import { decodePngPixels } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { pixelArtAssetKind, PIXEL_ART_KIND } from "#src/index.ts";
import type { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";
import { pixelSnapshotSchema } from "#src/network/protocol/PixelCommand.schema.ts";
import type { PixelWireCommand, PixelWireSnapshot } from "#src/network/protocol/types.ts";
const kRedTuple = [255, 0, 0, 255];

function binding(
  state: PixelArtState
): AssetRoomBinding<PixelArtState> {
  return {
    assetId: "asset-1",
    kind: PIXEL_ART_KIND,
    roomId: `${PIXEL_ART_KIND}:asset-1`,
    state
  };
}

function liveProtocol(
  state?: PixelArtState
): AssetLiveProtocol<PixelWireCommand> {
  const handler = pixelArtAssetKind();

  return handler.commands!.live!(
    binding(state ?? handler.create("asset-1"))
  );
}

describe("pixelArtAssetKind", () => {
  test("correct() defers to a snapshot for commands that do not paint pixels", () => {
    const protocol = liveProtocol();
    const resized: PixelWireCommand = {
      clientId: "bob",
      seq: 1,
      timestamp: 1_000,
      action: "resized",
      metadata: { size: { x: 8, y: 8 } }
    };

    assert.strictEqual(protocol.correct!(resized, null), null);
  });

  test("live() encodes the snapshot pixels as a PNG", async() => {
    const handler = pixelArtAssetKind({ defaultSize: { x: 2, y: 2 } });
    const state = handler.create("asset-1");
    state.document.buffer.pixels().set(kRedTuple, 4);
    const protocol = handler.commands!.live!(binding(state));
    const parser = new SchemaParser(pixelSnapshotSchema);

    const encoded = await protocol.encodeSnapshot!() as PixelWireSnapshot;
    const { pixels, size } = encoded;

    assert.strictEqual(parser.parse(encoded).ok, true);
    assert.ok(!(pixels instanceof Uint8Array));
    assert.deepEqual(
      [...await decodePngPixels(pixels, size)],
      [...state.document.buffer.pixels()]
    );
  });

  test("live() snapshots a copy of the current buffer as raw bytes", () => {
    const handler = pixelArtAssetKind({ defaultSize: { x: 1, y: 1 } });
    const state = handler.create("asset-1");
    const protocol = handler.commands!.live!(binding(state));
    const parser = new SchemaParser(pixelSnapshotSchema);
    state.document.buffer.pixels().set(kRedTuple);

    const snapshot = protocol.snapshot() as PixelWireSnapshot;
    state.document.buffer.pixels().fill(0);

    assert.strictEqual(parser.parse(snapshot).ok, true);
    assert.deepEqual(snapshot.pixels, new Uint8Array(kRedTuple));
    assert.strictEqual(protocol.compressSnapshot, true);
  });
});
