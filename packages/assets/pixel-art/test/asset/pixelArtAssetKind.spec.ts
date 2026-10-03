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
import {
  MessageParser,
  MessageProtocol,
  SchemaParser
} from "@jolly-pixel/network";
import {
  decodePngPixels,
  encodePixelArtDocument,
  PixelBuffer,
  pixelArtSnapshot,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  ASSET_KINDS,
  pixelArtAssetKind,
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND
} from "#src/index.ts";
import type { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";
import { pixelSnapshotSchema } from "#src/network/PixelCommand.schema.ts";
import type {
  PixelNetworkCommand,
  PixelWireCommand,
  PixelWireSnapshot
} from "#src/network/types.ts";
import { packed } from "../fixtures/commands.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kRedTuple = [255, 0, 0, 255];
const kWhiteTuple = [255, 255, 255, 255];

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

function liveProtocol(
  state?: PixelArtState
): AssetLiveProtocol<PixelWireCommand> {
  const handler = pixelArtAssetKind();

  return handler.commands!.live!(
    binding(state ?? handler.create("asset-1"))
  );
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

    assert.deepEqual(state.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("a delete erases the pixels and keeps the size", () => {
    const handler = pixelArtAssetKind({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 8, y: 8 } });
    source.drawPixels([{ x: 1, y: 1 }], kRed);
    foldAssetEvent(handler, state, documentEvent(source));

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND
    }));

    assert.deepEqual(state.buffer.size(), { x: 8, y: 8 });
    assert.deepEqual(
      state.buffer.pixels(),
      new Uint8ClampedArray(8 * 8 * 4)
    );
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
    assert.deepEqual(commands!.protocol.events, [
      "stroke",
      "resized",
      "texture-replaced",
      "global-fill",
      "select-edit",
      "uv-region-created",
      "uv-region-deleted",
      "uv-region-moved",
      "uv-region-state-changed",
      "uv-region-rotated",
      "normal-map-toggled",
      "normal-map-defaults-patched",
      "normal-map-zone-set",
      "normal-map-zone-deleted"
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

  test("correct() restores the authoritative colors of every pixel of a rejected stroke", () => {
    const handler = pixelArtAssetKind({ defaultSize: { x: 4, y: 4 } });
    const state = handler.create("asset-1");
    state.buffer.drawPixels([{ x: 1, y: 0 }], kRed);
    const protocol = liveProtocol(state);
    const rejected = stroke([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1_000, "bob");

    assert.deepEqual(protocol.correct!(rejected, null), {
      clientId: "bob",
      seq: 1,
      timestamp: 1_000,
      action: "select-edit",
      metadata: {
        xy: [0, 0, 1, 0],
        rgba: [...kWhiteTuple, ...kRedTuple]
      }
    });
  });

  test("correct() only restores the pixels the admitted stroke dropped", () => {
    const protocol = liveProtocol();
    const sent = stroke([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1_000, "bob");
    const admitted = stroke([{ x: 1, y: 0 }], 1_000, "bob");

    const correction = protocol.correct!(sent, packed(admitted));

    assert.deepEqual(correction?.metadata, {
      xy: [0, 0],
      rgba: kWhiteTuple
    });
  });

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
    state.buffer.pixels().set(kRedTuple, 4);
    const protocol = handler.commands!.live!(binding(state));
    const parser = new MessageParser(new MessageProtocol({
      title: "snapshot",
      ...pixelSnapshotSchema
    }));

    const encoded = await protocol.encodeSnapshot!() as PixelWireSnapshot;
    const { pixels, size } = encoded;

    assert.strictEqual(parser.parse(encoded).ok, true);
    assert.ok(typeof pixels !== "string");
    assert.deepEqual(
      [...await decodePngPixels(pixels, size)],
      [...state.buffer.pixels()]
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

describe("ASSET_KINDS", () => {
  test("describes every kind it handles", () => {
    const handlers = ASSET_KINDS.handlers();

    assert.deepEqual(
      handlers.map((handler) => handler.kind),
      [PIXEL_ART_KIND]
    );
    assert.deepEqual(
      ASSET_KINDS.descriptors.map((descriptor) => descriptor.kind),
      [PIXEL_ART_KIND]
    );
  });

  test("passes its options to the handler", () => {
    const snapshot = {
      delay: 10
    };
    const [handler] = ASSET_KINDS.handlers({
      snapshot
    });

    assert.strictEqual(handler.snapshot, snapshot);
  });

  test("accepts only the JSON options of the handler", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);

    assert.ok(parser.parse({
      defaultSize: {
        x: 64,
        y: 64
      },
      snapshot: {
        delay: 10
      }
    }).ok);
    for (const options of [
      { defaultSize: { x: 0, y: 64 } },
      { snapshot: { delay: -1 } },
      { size: 64 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
