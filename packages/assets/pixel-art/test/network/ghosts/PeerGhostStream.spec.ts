// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerGhostStream } from "#src/network/ghosts/PeerGhostStream.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import { command } from "../../fixtures/commands.ts";
import {
  callsOf,
  nextFrame
} from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

function createLayer() {
  return {
    set: mock.fn<(clientId: string, payload: string) => void>(),
    remove: mock.fn<(clientId: string) => void>(),
    clearAll: mock.fn<() => void>()
  };
}

function setup(
  room = new MockRoom()
) {
  const layer = createLayer();
  const reconcile = mock.fn<(received: PixelNetworkCommand) => void>();
  const stream = new PeerGhostStream({
    room,
    key: "testGhost",
    decode: (value) => (typeof value === "string" ? value : undefined),
    layer,
    reconcile
  });

  return {
    room,
    layer,
    reconcile,
    stream
  };
}

describe("PeerGhostStream — local reporting", () => {
  test("reports the latest payload once on the next frame", async() => {
    const { room, stream } = setup();

    stream.report("a");
    stream.report("b");
    assert.deepStrictEqual(room.presenceUpdates, []);

    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ testGhost: "b" }]);
    assert.strictEqual(stream.pending, "b");
  });

  test("cancelPending drops the queued report", async() => {
    const { room, stream } = setup();

    stream.report("a");
    stream.cancelPending();
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
    assert.strictEqual(stream.pending, undefined);
  });

  test("clearLocal cancels the queued report and publishes null", async() => {
    const { room, stream } = setup();

    stream.report("a");
    stream.clearLocal();
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ testGhost: null }]);
  });
});

describe("PeerGhostStream — remote peers", () => {
  test("applies ghosts already stored in peer presence", () => {
    const room = new MockRoom();
    room.addPeer("peer-B", { presence: { testGhost: "ghost" } });

    const { layer } = setup(room);

    assert.deepStrictEqual(callsOf(layer.set), [["peer-B", "ghost"]]);
  });

  test("clears a ghost after 1500ms without renewal", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { room, layer } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: "ghost" } });
    t.mock.timers.tick(1499);
    assert.strictEqual(layer.remove.mock.callCount(), 0);

    t.mock.timers.tick(1);

    assert.deepStrictEqual(callsOf(layer.remove), [["peer-B"]]);
  });

  test("null, an undecodable payload and peer-left remove the ghost", () => {
    const { room, layer } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: "ghost" } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: null } });
    room.emit("peer-presence", { clientId: "peer-C", patch: { testGhost: "ghost" } });
    room.emit("peer-presence", { clientId: "peer-C", patch: { testGhost: 42 } });
    room.emit("peer-presence", { clientId: "peer-D", patch: { testGhost: "ghost" } });
    room.emit("peer-left", { clientId: "peer-D" });

    assert.deepStrictEqual(callsOf(layer.remove), [["peer-B"], ["peer-C"], ["peer-D"]]);
  });

  test("a snapshot clears every ghost", () => {
    const { room, layer } = setup();

    room.deliverSnapshot();

    assert.strictEqual(layer.clearAll.mock.callCount(), 1);
  });

  test("commands are handed to reconcile", () => {
    const { room, reconcile } = setup();
    const resized = command("resized", { size: { x: 1, y: 1 } });

    room.deliverCommand(resized);

    assert.deepStrictEqual(callsOf(reconcile), [[resized]]);
  });
});

describe("PeerGhostStream — destroy", () => {
  test("removes its room listeners, clears ghosts and cancels the pending report", async() => {
    const room = new MockRoom();
    const left = mock.fn();
    room.on("peer-left", left);
    const { layer, reconcile, stream } = setup(room);

    stream.report("a");
    stream.destroy();
    room.emit("peer-left", { clientId: "peer-B" });
    room.deliverCommand(command("resized", { size: { x: 1, y: 1 } }));
    await nextFrame();

    assert.strictEqual(left.mock.callCount(), 1);
    assert.strictEqual(reconcile.mock.callCount(), 0);
    assert.strictEqual(layer.clearAll.mock.callCount(), 1);
    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});
