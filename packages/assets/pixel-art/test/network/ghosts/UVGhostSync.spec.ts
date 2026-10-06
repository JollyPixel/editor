// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  UVRegion,
  type PeerUVPreviewState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  UVGhostSync,
  type UVGhostSyncOptions
} from "#src/network/ghosts/UVGhostSync.ts";
import type { UVGhostPayload } from "#src/network/types.ts";
import {
  command,
  freeRegion
} from "../../fixtures/commands.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import {
  callsOf,
  nextFrame
} from "../../helpers/mock.ts";
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

describe("UVGhostSync — remote peers", () => {
  test("draws a peer uvGhost with a peer color", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    const [[clientId, state]] = callsOf(overlay.set);
    assert.strictEqual(clientId, "peer-B");
    assert.strictEqual(state.region.id, kPayload.id);
    assert.strictEqual(state.region.color, "#peer-B");
    assert.strictEqual(state.color, "#peer-B");
  });

  test("colors a peer uvGhost with the color option and the peer profile", () => {
    const { room, overlay } = setup({
      color: (clientId, profile) => `${clientId}:${String(profile.tint)}`
    });
    room.addPeer("peer-B", { profile: { tint: "red" } });

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    assert.strictEqual(callsOf(overlay.set)[0][1].color, "peer-B:red");
  });

  test("draws a peer's dragged region from its layout", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { ...kPayload, layout: kNet.toLayout() } }
    });

    const [[, state]] = callsOf(overlay.set);
    assert.deepStrictEqual(state.region.toLayout(), kNet.toLayout());
    assert.strictEqual(state.face, null);
  });

  test("ignores a malformed uvGhost payload", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: "not-an-object" } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: { face: null } } });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { id: kPayload.id, face: null } }
    });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { ...kPayload, layout: { state: "unfolded" } } }
    });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { ...kPayload, face: 3 } }
    });

    assert.strictEqual(overlay.set.mock.callCount(), 0);
  });

  test("removes a leaving peer's ghost and clears all ghosts on snapshot", () => {
    const { room, overlay } = setup();
    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    room.emit("peer-left", { clientId: "peer-B" });
    room.deliverSnapshot();

    assert.deepStrictEqual(callsOf(overlay.remove), [["peer-B"]]);
    assert.strictEqual(overlay.clearAll.mock.callCount(), 1);
  });

  test("reports a peer's in-progress drag through onRemoteRegionDragging", () => {
    const onRemoteRegionDragging = mock.fn<(region: UVRegion) => void>();
    const { room, overlay } = setup({ onRemoteRegionDragging });

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    const [[region]] = callsOf(onRemoteRegionDragging);
    assert.strictEqual(region, callsOf(overlay.set)[0][1].region);
    assert.strictEqual(region.id, kPayload.id);
    assert.deepStrictEqual(region.toLayout(), kPayload.layout);
  });

  test("does not call onRemoteRegionDragging for a malformed payload", () => {
    const onRemoteRegionDragging = mock.fn<(region: UVRegion) => void>();
    const { room } = setup({ onRemoteRegionDragging });

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: "not-an-object" } });

    assert.strictEqual(onRemoteRegionDragging.mock.callCount(), 0);
  });
});

describe("UVGhostSync — reconciliation", () => {
  test("region commands remove ghosts by region id", () => {
    const { room, overlay } = setup();
    const header = { clientId: "peer-B" };

    const rect = { x: 0, y: 0, width: 1, height: 1 };

    room.deliverCommand(command("uv-region-moved", { id: "r1", face: null, rect }, header));
    room.deliverCommand(command("uv-region-deleted", { id: "r2" }, header));
    room.deliverCommand(command("uv-region-state-changed", {
      region: freeRegion("r3")
    }, header));

    assert.deepStrictEqual(callsOf(overlay.removeByRegion), [["r1"], ["r2"], ["r3"]]);
    assert.strictEqual(overlay.remove.mock.callCount(), 0);
  });
});
