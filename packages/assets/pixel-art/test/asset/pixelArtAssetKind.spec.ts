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
  InvalidAssetFileError,
  type AssetEventData
} from "@jolly-pixel/asset-server";
import {
  encodePixelArtFile,
  PixelBuffer,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  pixelArtAssetKind,
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND
} from "#src/index.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import { packed } from "../fixtures/commands.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kRedTuple = [255, 0, 0, 255];

function event(
  eventType: string,
  eventData: AssetEventData | PixelNetworkCommand | unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: PIXEL_ART_KIND,
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
  buffer: PixelBuffer
): EventStore.Event {
  const data = encodePixelArtFile(
    serializePixelDocument(new PixelDocumentState({ buffer }))
  );

  return event(ASSET_CREATED, {
    path: "a.pixelart",
    kind: PIXEL_ART_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

function strokeCommand(
  positions: { x: number; y: number; }[]
): PixelNetworkCommand {
  return {
    action: "stroke",
    metadata: {
      color: kRed,
      positions
    },
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };
}

describe("pixelArtAssetKind", () => {
  test("declares its kind and claims .pixelart paths", () => {
    const handler = pixelArtAssetKind();

    assert.strictEqual(handler.kind, PIXEL_ART_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [PIXEL_ART_EXTENSION]);
    assert.strictEqual(handler.match, undefined);
  });

  test("creates a buffer at the default size", () => {
    const state = pixelArtAssetKind().create("asset-1");

    assert.deepEqual(state.document.buffer.size(), { x: 32, y: 32 });
  });

  test("honours a configured default size", () => {
    const state = pixelArtAssetKind({
      defaultSize: { x: 8, y: 8 }
    }).create("asset-1");

    assert.deepEqual(state.document.buffer.size(), { x: 8, y: 8 });
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = pixelArtAssetKind();
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 4, y: 4 } });
    source.drawPixels([{ x: 2, y: 2 }], kRed);

    foldAssetEvent(handler, state, fileEvent(source));

    assert.deepEqual(state.document.buffer.size(), { x: 4, y: 4 });
    assert.deepEqual(state.document.buffer.samplePixel(2, 2), kRedTuple);
  });

  test("a domain command mutates the folded buffer", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");

    foldAssetEvent(
      handler,
      state,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 1, y: 1 }]))
    );

    assert.deepEqual(state.document.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("a packed domain command mutates the folded buffer", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");

    foldAssetEvent(
      handler,
      state,
      event(PIXEL_ART_COMMAND, packed(strokeCommand([{ x: 1, y: 1 }])))
    );

    assert.deepEqual(state.document.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("a delete erases the pixels and keeps the size", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 8, y: 8 } });
    source.drawPixels([{ x: 1, y: 1 }], kRed);
    foldAssetEvent(handler, state, fileEvent(source));

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND
    }));

    assert.deepEqual(state.document.buffer.size(), { x: 8, y: 8 });
    assert.deepEqual(
      state.document.buffer.pixels(),
      new Uint8ClampedArray(8 * 8 * 4)
    );
  });

  test("ignores an unrelated domain event", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const before = Uint8ClampedArray.from(state.document.buffer.pixels());

    foldAssetEvent(handler, state, event("something.else", { nope: true }));

    assert.deepEqual(state.document.buffer.pixels(), before);
  });

  test("a malformed document throws before touching the buffer", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    foldAssetEvent(
      handler,
      state,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 1, y: 1 }]))
    );

    assert.throws(() => {
      foldAssetEvent(handler, state, event(ASSET_CREATED, {
        path: "a.pixelart",
        kind: PIXEL_ART_KIND,
        hash: "h1",
        size: 2,
        content: encodeContent(new TextEncoder().encode("{{"))
      }));
    }, InvalidAssetFileError);
    assert.deepEqual(state.document.buffer.samplePixel(1, 1), kRedTuple);
  });
});
