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
  type AssetEventData,
  type AssetLiveProtocol,
  type AssetRoomBinding
} from "@jolly-pixel/asset-server";
import { protocolEvents } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  pixelArtAssetHandler,
  PIXEL_ART_COMMAND,
  PIXEL_ART_KIND
} from "#src/asset/pixelArtAssetHandler.ts";
import {
  encodePixelArtDocument,
  serializePixelBuffer
} from "#src/serialization/index.ts";
import { pixelArtSnapshot } from "#src/serialization/buffer.ts";
import { PIXEL_NETWORK_ACTIONS } from "#src/network/PixelCommandValidator.ts";
import type { PixelArtState } from "#src/asset/PixelArtState.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
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
  const handler = pixelArtAssetHandler();

  return handler.live!(binding(handler.create("asset-1")));
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

describe("pixelArtAssetHandler", () => {
  test("declares its kind and claims .pixelart paths", () => {
    const handler = pixelArtAssetHandler();

    assert.strictEqual(handler.kind, PIXEL_ART_KIND);
    assert.deepEqual(handler.match, ["**/*.pixelart"]);
  });

  test("creates a buffer at the default size", () => {
    const state = pixelArtAssetHandler().create("asset-1");

    assert.deepEqual(state.buffer.size(), { x: 32, y: 32 });
  });

  test("honours a configured default size", () => {
    const state = pixelArtAssetHandler({
      defaultSize: { x: 8, y: 8 }
    }).create("asset-1");

    assert.deepEqual(state.buffer.size(), { x: 8, y: 8 });
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = pixelArtAssetHandler();
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 4, y: 4 } });
    source.drawPixels([{ x: 2, y: 2 }], kRed);

    handler.apply(state, documentEvent(source));

    assert.deepEqual(state.buffer.size(), { x: 4, y: 4 });
    assert.deepEqual(state.buffer.samplePixel(2, 2), kRedTuple);
  });

  test("a domain command mutates the folded buffer", () => {
    const handler = pixelArtAssetHandler({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");

    handler.apply(
      state,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 1, y: 1 }]))
    );

    assert.deepEqual(state.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("a delete resets the buffer to its default size", () => {
    const handler = pixelArtAssetHandler({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const source = new PixelBuffer({ size: { x: 8, y: 8 } });
    handler.apply(state, documentEvent(source));

    handler.apply(state, event(ASSET_DELETED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND
    }));

    assert.deepEqual(state.buffer.size(), { x: 4, y: 4 });
  });

  test("ignores an unrelated domain event", () => {
    const handler = pixelArtAssetHandler({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    const before = Uint8ClampedArray.from(state.buffer.pixels());

    handler.apply(state, event("something.else", { nope: true }));

    assert.deepEqual(state.buffer.pixels(), before);
  });

  test("a malformed event never throws and keeps the last good state", () => {
    const handler = pixelArtAssetHandler({
      defaultSize: { x: 4, y: 4 }
    });
    const state = handler.create("asset-1");
    handler.apply(
      state,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 1, y: 1 }]))
    );

    assert.doesNotThrow(() => {
      handler.apply(state, event(ASSET_CREATED, {
        path: "a.pixelart",
        kind: PIXEL_ART_KIND,
        hash: "h1",
        size: 2,
        content: encodeContent(new TextEncoder().encode("{{"))
      }));
    });
    assert.deepEqual(state.buffer.samplePixel(1, 1), kRedTuple);
  });

  test("serialize round-trips through apply", async() => {
    const handler = pixelArtAssetHandler({
      defaultSize: { x: 4, y: 4 }
    });
    const first = handler.create("asset-1");
    handler.apply(
      first,
      event(PIXEL_ART_COMMAND, strokeCommand([{ x: 3, y: 3 }]))
    );

    const data = await handler.serialize(first);
    const second = handler.create("asset-1");
    handler.apply(second, event(ASSET_CREATED, {
      path: "a.pixelart",
      kind: PIXEL_ART_KIND,
      hash: "h1",
      size: data.byteLength,
      content: encodeContent(data)
    }));

    assert.deepEqual(second.buffer.pixels(), first.buffer.pixels());
  });

  test("live() declares the pixel command stream", () => {
    const protocol = liveProtocol();

    assert.strictEqual(protocol.commandEventType, PIXEL_ART_COMMAND);
    assert.deepEqual(
      protocolEvents(protocol.protocols.inbound!),
      [...PIXEL_NETWORK_ACTIONS]
    );
  });

  test("live() rejects a payload that is not a pixel command", () => {
    const protocol = liveProtocol();

    assert.strictEqual(protocol.parse({ action: "stroke" }), null);
    assert.strictEqual(protocol.parse(null), null);
  });

  test("live() stamps the server-side client id onto the command", () => {
    const protocol = liveProtocol();
    const arbitration = protocol.arbitrate(
      stroke([{ x: 1, y: 1 }], 1_000, "spoofed"),
      "alice"
    );

    assert.notStrictEqual(arbitration, null);
    assert.strictEqual(arbitration!.command.clientId, "alice");
  });

  test("live() gives each room its own conflict tracker", () => {
    const first = liveProtocol();
    const second = liveProtocol();

    first.arbitrate(stroke([{ x: 0, y: 0 }], 2_000), "alice")!.commit!();

    assert.notStrictEqual(
      second.arbitrate(stroke([{ x: 0, y: 0 }], 1_000), "bob"),
      null
    );
  });

  test("an uncommitted arbitration leaves the tracker untouched", () => {
    const protocol = liveProtocol();

    protocol.arbitrate(stroke([{ x: 0, y: 0 }], 2_000), "alice");

    assert.notStrictEqual(
      protocol.arbitrate(stroke([{ x: 0, y: 0 }], 1_000), "bob"),
      null
    );
  });

  test("a committed arbitration rejects the older write", () => {
    const protocol = liveProtocol();

    protocol.arbitrate(stroke([{ x: 0, y: 0 }], 2_000), "alice")!.commit!();

    assert.strictEqual(
      protocol.arbitrate(stroke([{ x: 0, y: 0 }], 1_000), "bob"),
      null
    );
  });

  test("live() snapshots the current buffer", () => {
    const handler = pixelArtAssetHandler({ defaultSize: { x: 2, y: 2 } });
    const state = handler.create("asset-1");
    const protocol = handler.live!(binding(state));

    assert.deepEqual(
      protocol.snapshot(),
      pixelArtSnapshot(state.buffer)
    );
  });
});
