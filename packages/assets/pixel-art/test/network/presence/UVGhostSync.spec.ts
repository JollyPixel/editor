// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UVRegion, type PeerUVPreviewState } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGhostSync, type UVGhostSyncOptions } from "#src/network/presence/UVGhostSync.ts";
import type { UVGhostPayload } from "#src/network/presence/types.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import { nextFrame } from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

type UVEvents = {
  "region-dragging": (event: { region: UVRegion; face: string | null; }) => void;
  "region-state-changed": (event: { region: { id: string; }; }) => void;
  "region-moved": (event: { region: { id: string; }; }) => void;
  "region-drag-ended": (event: { id: string; committed: boolean; }) => void;
};

// CONSTANTS
const kStacked = new UVRegion({
  id: "region-A",
  color: "#f00",
  state: "stacked",
  rect: { x: 0, y: 0, width: 4, height: 4 }
});
const kDrag = {
  region: kStacked,
  face: null
};
const kPayload: UVGhostPayload = {
  id: "region-A",
  face: null,
  layout: kStacked.toLayout()
};

const kNet = new UVRegion({
  id: "region-A",
  color: "#f00",
  state: "unfolded",
  faces: {
    front: { x: 0, y: 0, width: 4, height: 4 },
    back: { x: 4, y: 0, width: 6, height: 4 }
  }
});

class MockUVMap extends MockEmitter<UVEvents> {
  selectedRegionId: string | null = kStacked.id;
}

function peerColor(
  clientId: string
): string {
  return `#${clientId}`;
}

function setup(
  options: Partial<Pick<UVGhostSyncOptions, "color" | "onRemoteRegionDragging">> = {}
) {
  const room = new MockRoom();
  const host = {
    uv: new MockUVMap(),
    peerPresence: {
      uv: {
        set: mock.fn<(clientId: string, state: PeerUVPreviewState) => void>(),
        remove: mock.fn<(clientId: string) => void>(),
        clearAll: mock.fn<() => void>(),
        removeByRegion: mock.fn<(id: string) => void>()
      }
    }
  };
  new UVGhostSync({
    room,
    canvas: asCanvas(host),
    color: peerColor,
    ...options
  });

  return {
    room,
    events: host.uv,
    overlay: host.peerPresence.uv
  };
}

describe("UVGhostSync — local drag", () => {
  test("reports region dragging as uvGhost presence", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kDrag);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: kPayload }]);
  });

  test("reports only the selected region when a drag carries nested regions", async() => {
    const { room, events } = setup();
    const nested = new UVRegion({
      id: "region-B",
      color: "#0f0",
      state: "stacked",
      rect: { x: 1, y: 1, width: 2, height: 2 }
    });

    events.emit("region-dragging", kDrag);
    events.emit("region-dragging", { region: nested, face: null });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: kPayload }]);
  });

  test("moving the dragged region cancels the pending report", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kDrag);
    events.emit("region-moved", { region: { id: kPayload.id } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });

  test("moving another region keeps the pending report", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kDrag);
    events.emit("region-moved", { region: { id: "region-B" } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: kPayload }]);
  });

  test("reports a net drag with its whole layout", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", { region: kNet, face: null });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{
      uvGhost: {
        id: kNet.id,
        face: null,
        layout: kNet.toLayout()
      }
    }]);
  });

  test("reports the dragged slot of a free region", async() => {
    const { room, events } = setup();
    const free = kNet.free().resized({ x: 0, y: 0, width: 5, height: 4 }, "front");

    events.emit("region-dragging", { region: free, face: "front" });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{
      uvGhost: {
        id: kNet.id,
        face: "front",
        layout: free.toLayout()
      }
    }]);
  });

  test("committing a new state for the dragged region cancels the pending report", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", { region: kNet, face: null });
    events.emit("region-state-changed", { region: { id: kNet.id } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });

  test("a cancelled drag clears presence immediately", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kDrag);
    events.emit("region-drag-ended", { id: kPayload.id, committed: false });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: null }]);
  });

  test("a committed drag clears presence too", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kDrag);
    events.emit("region-drag-ended", { id: kPayload.id, committed: true });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: null }]);
  });
});
