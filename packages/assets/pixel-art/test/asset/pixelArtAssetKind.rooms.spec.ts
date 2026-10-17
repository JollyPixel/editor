// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData,
  type AssetLiveProtocol,
  type AssetRoomBinding
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  pixelArtAssetKind,
  PIXEL_ART_COMMAND,
  PIXEL_ART_KIND
} from "#src/index.ts";
import type { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";
import type { PixelNetworkCommand, PixelWireCommand } from "#src/network/types.ts";
import { packed } from "../fixtures/commands.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
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

const kRedTuple = [255, 0, 0, 255];

describe("pixelArtAssetKind", () => {
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

    assert.deepEqual(second.document.buffer.pixels(), first.document.buffer.pixels());
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
      "palette-color-changed",
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
    const before = Uint8ClampedArray.from(state.document.buffer.pixels());

    foldAssetEvent(handler, state, event(PIXEL_ART_COMMAND, {
      ...strokeCommand([{ x: 1, y: 1 }]),
      seq: -1
    }));
    foldAssetEvent(handler, state, event(PIXEL_ART_COMMAND, null));

    assert.deepEqual(state.document.buffer.pixels(), before);
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
    state.document.buffer.drawPixels([{ x: 1, y: 0 }], kRed);
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
});
