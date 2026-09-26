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
  InvalidAssetDocumentError,
  type AssetEventData,
  type AssetLiveProtocol,
  type AssetRoomBinding
} from "@jolly-pixel/asset-server";
import { protocolEvents } from "@jolly-pixel/network";
import {
  encodePixelArtDocument,
  PixelBuffer,
  pixelArtSnapshot,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  pixelArtAssetKind,
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND
} from "#src/index.ts";
import type { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

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

function documentEvent(
  buffer: PixelBuffer
): EventStore.Event {
  const data = encodePixelArtDocument(serializePixelBuffer(buffer));

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

function liveProtocol(): AssetLiveProtocol<PixelNetworkCommand> {
  const handler = pixelArtAssetKind();

  return handler.commands!.live!(binding(handler.create("asset-1")));
}

function stroke(
  positions: { x: number; y: number; }[],
  timestamp = 1000,
  clientId = "client-A"
): PixelNetworkCommand {
  return {
    action: "stroke",
    metadata: {
      color: kRed,
      positions
    },
    clientId,
    seq: 1,
    timestamp
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

    assert.deepEqual(state.buffer.size(), { x: 32, y: 32 });
  });

  test("honours a configured default size", () => {
    const state = pixelArtAssetKind({
      defaultSize: { x: 8, y: 8 }
    }).create("asset-1");

    assert.deepEqual(state.buffer.size(), { x: 8, y: 8 });
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = pixelArtAssetKind();
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 4, y: 4 } });
    source.drawPixels([{ x: 2, y: 2 }], kRed);

    foldAssetEvent(handler, state, documentEvent(source));

    assert.deepEqual(state.buffer.size(), { x: 4, y: 4 });
    assert.deepEqual(state.buffer.samplePixel(2, 2), kRedTuple);
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

    assert.deepEqual(state.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("a delete resets the buffer to its default size", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 8, y: 8 } });
    foldAssetEvent(handler, state, documentEvent(source));

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND
    }));

    assert.deepEqual(state.buffer.size(), { x: 4, y: 4 });
  });

  test("ignores an unrelated domain event", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const before = Uint8ClampedArray.from(state.buffer.pixels());

    foldAssetEvent(handler, state, event("something.else", { nope: true }));

    assert.deepEqual(state.buffer.pixels(), before);
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
    }, InvalidAssetDocumentError);
    assert.deepEqual(state.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("serialize round-trips through apply", async() => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const first = handler.create("asset-1");
    foldAssetEvent(
      handler,
      first,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 3, y: 3 }]))
    );

    const data = await handler.serialize(first);
    const second = handler.create("asset-1");
    foldAssetEvent(handler, second, event(ASSET_CREATED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND,
      hash: "h1",
      size: data.byteLength,
      content: encodeContent(data)
    }));

    assert.deepEqual(second.buffer.pixels(), first.buffer.pixels());
  });

  test("declares the pixel command stream", () => {
    const { commands } = pixelArtAssetKind();

    assert.strictEqual(commands!.eventType, PIXEL_ART_COMMAND);
    assert.deepEqual(protocolEvents(commands!.protocol), [
      "stroke",
      "resized",
      "texture-replaced",
      "global-fill",
      "select-edit",
      "uv-region-created",
      "uv-region-deleted",
      "uv-region-moved",
      "uv-region-state-changed",
      "uv-region-rotated"
    ]);
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const before = Uint8ClampedArray.from(state.buffer.pixels());

    foldAssetEvent(handler, state, event(PIXEL_ART_COMMAND, {
      ...strokeCommand([{ x: 1, y: 1 }]),
      seq: -1
    }));
    foldAssetEvent(handler, state, event(PIXEL_ART_COMMAND, null));

    assert.deepEqual(state.buffer.pixels(), before);
  });

  test("live() gives each room its own conflict tracker", () => {
    const first = liveProtocol();
    const second = liveProtocol();

    first.arbitrate(stroke([{ x: 0, y: 0 }], 2_000, "alice"))!.commit!();

    assert.notStrictEqual(
      second.arbitrate(stroke([{ x: 0, y: 0 }], 1_000, "bob")),
      null
    );
  });

  test("an uncommitted arbitration leaves the tracker untouched", () => {
    const protocol = liveProtocol();

    protocol.arbitrate(stroke([{ x: 0, y: 0 }], 2_000, "alice"));

    assert.notStrictEqual(
      protocol.arbitrate(stroke([{ x: 0, y: 0 }], 1_000, "bob")),
      null
    );
  });

  test("a committed arbitration rejects the older write", () => {
    const protocol = liveProtocol();

    protocol.arbitrate(stroke([{ x: 0, y: 0 }], 2_000, "alice"))!.commit!();

    assert.strictEqual(
      protocol.arbitrate(stroke([{ x: 0, y: 0 }], 1_000, "bob")),
      null
    );
  });

  test("live() snapshots the current buffer", () => {
    const handler = pixelArtAssetKind({ defaultSize: { x: 2, y: 2 } });
    const state = handler.create("asset-1");
    const protocol = handler.commands!.live!(binding(state));

    assert.deepEqual(
      protocol.snapshot(),
      pixelArtSnapshot(state.buffer)
    );
  });
});
