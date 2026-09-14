// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerUVPreviewState } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGhostSync } from "#src/network/ghosts/UVGhostSync.ts";
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
  "region-dragging": (event: UVGhostPayload) => void;
  "region-moved": (event: { region: { id: string; }; }) => void;
  "region-drag-ended": (event: { id: string; committed: boolean; }) => void;
};

// CONSTANTS
const kPayload: UVGhostPayload = {
  id: "region-A",
  face: null,
  geometry: { x: 0, y: 0, width: 4, height: 4 }
};

function setup() {
  const room = new MockRoom();
  const host = {
    uv: new MockEmitter<UVEvents>(),
    peerPresence: {
      uv: {
        set: mock.fn<(clientId: string, state: PeerUVPreviewState) => void>(),
        remove: mock.fn<(clientId: string) => void>(),
        clearAll: mock.fn<() => void>(),
        removeByRegion: mock.fn<(id: string) => void>()
      }
    }
  };
  const sync = new UVGhostSync({ room });
  sync.attach(asCanvas(host));

  return {
    room,
    events: host.uv,
    overlay: host.peerPresence.uv
  };
}

describe("UVGhostSync — local drag", () => {
  test("reports region dragging as uvGhost presence", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kPayload);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: kPayload }]);
  });

  test("moving the dragged region cancels the pending report", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kPayload);
    events.emit("region-moved", { region: { id: kPayload.id } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });

  test("moving another region keeps the pending report", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kPayload);
    events.emit("region-moved", { region: { id: "region-B" } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ uvGhost: kPayload }]);
  });

  test("a cancelled drag clears presence immediately", async() => {
    const { room, events } = setup();

    events.emit("region-dragging", kPayload);
    events.emit("region-drag-ended", { id: kPayload.id, committed: false });
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
    assert.strictEqual(state.id, kPayload.id);
    assert.ok(state.color.length > 0);
  });

  test("ignores a malformed uvGhost payload", () => {
    const { room, overlay } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: "not-an-object" } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { uvGhost: { face: null } } });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { uvGhost: { ...kPayload, geometry: { shape: "unknown" } } }
    });

    assert.strictEqual(overlay.set.mock.callCount(), 0);
  });

  test("removes a leaving peer's ghost and clears all ghosts on snapshot", () => {
    const { room, overlay } = setup();

    room.emit("peer-left", { clientId: "peer-B" });
    room.deliverSnapshot();

    assert.deepStrictEqual(callsOf(overlay.remove), [["peer-B"]]);
    assert.strictEqual(overlay.clearAll.mock.callCount(), 1);
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
