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
import { command, freeRegion } from "../../fixtures/commands.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import { readCalls } from "../../helpers/mock.ts";
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

describe("UVGhostSync — remote peers", () => {
  test("draws a peer uvGhost with a peer color", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    const [[clientId, state]] = readCalls(overlay.set);
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

    assert.strictEqual(readCalls(overlay.set)[0][1].color, "peer-B:red");
  });

  test("draws a peer's dragged region from its layout", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { ...kPayload, layout: kNet.toLayout() } }
    });

    const [[, state]] = readCalls(overlay.set);
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

    assert.deepStrictEqual(readCalls(overlay.remove), [["peer-B"]]);
    assert.strictEqual(overlay.clearAll.mock.callCount(), 1);
  });

  test("reports a peer's in-progress drag through onRemoteRegionDragging", () => {
    const onRemoteRegionDragging = mock.fn<(region: UVRegion) => void>();
    const { room, overlay } = setup({ onRemoteRegionDragging });

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: kPayload } });

    const [[region]] = readCalls(onRemoteRegionDragging);
    assert.strictEqual(region, readCalls(overlay.set)[0][1].region);
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

    assert.deepStrictEqual(readCalls(overlay.removeByRegion), [["r1"], ["r2"], ["r3"]]);
    assert.strictEqual(overlay.remove.mock.callCount(), 0);
  });
});
