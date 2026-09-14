// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerPresenceGhostSync,
  type PeerPresenceGhostSyncOptions
} from "#src/network/ghosts/PeerPresenceGhostSync.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import { command } from "../../fixtures/commands.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import {
  callsOf,
  nextFrame
} from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

type LocalEvents = {
  progress: (payload: string) => void;
};

class TestGhostSync extends PeerPresenceGhostSync<string> {
  protected readonly presenceKey = "testGhost";

  readonly local = new MockEmitter<LocalEvents>();
  readonly applied = mock.fn<(clientId: string, payload: string) => void>();
  readonly cleared = mock.fn<(clientId: string) => void>();
  readonly clearedAll = mock.fn<() => void>();
  readonly reconciled = mock.fn<(command: PixelNetworkCommand) => void>();

  #onProgress = (
    payload: string
  ): void => {
    this.reportLocal(payload);
  };

  protected isEmptyPayload(
    payload: string
  ): boolean {
    return payload === "";
  }

  protected isExplicitClear(
    value: unknown
  ): boolean {
    return value === null;
  }

  protected subscribeLocal(): void {
    this.local.on("progress", this.#onProgress);
  }

  protected unsubscribeLocal(): void {
    this.local.off("progress", this.#onProgress);
  }

  protected decodePayload(
    value: unknown
  ): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  protected applyGhost(
    clientId: string,
    payload: string
  ): void {
    this.applied(clientId, payload);
  }

  protected clearGhost(
    clientId: string
  ): void {
    if (this.canvas) {
      this.cleared(clientId);
    }
  }

  protected clearAllGhosts(): void {
    this.clearedAll();
  }

  protected reconcileCommand(
    received: PixelNetworkCommand
  ): void {
    this.reconciled(received);
  }
}

function setup(
  options: Omit<PeerPresenceGhostSyncOptions, "room"> = {},
  room = new MockRoom()
) {
  const sync = new TestGhostSync({ room, ...options });
  sync.attach(asCanvas({}));

  return {
    room,
    sync
  };
}

describe("PeerPresenceGhostSync — attach", () => {
  test("throws when a canvas is already attached", () => {
    const { sync } = setup();

    assert.throws(() => sync.attach(asCanvas({})));
  });

  test("applies ghosts already stored in peer presence", () => {
    const room = new MockRoom();
    room.addPeer("peer-B", { presence: { testGhost: "ghost" } });

    const { sync } = setup({}, room);

    assert.deepStrictEqual(callsOf(sync.applied), [["peer-B", "ghost"]]);
  });

  test("with enableGhostPreview false, neither reports nor applies ghosts", async() => {
    const room = new MockRoom();
    room.addPeer("peer-B", { presence: { testGhost: "ghost" } });
    const { sync } = setup({ enableGhostPreview: false }, room);

    sync.local.emit("progress", "a");
    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: "ghost" } });
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
    assert.strictEqual(sync.applied.mock.callCount(), 0);
  });

  test("detach clears ghosts and stops reporting", async() => {
    const { room, sync } = setup();

    sync.detach();
    sync.local.emit("progress", "a");
    await nextFrame();

    assert.strictEqual(sync.clearedAll.mock.callCount(), 1);
    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});

describe("PeerPresenceGhostSync — local reporting", () => {
  test("reports the latest payload once on the next frame", async() => {
    const { room, sync } = setup();

    sync.local.emit("progress", "a");
    sync.local.emit("progress", "b");
    assert.deepStrictEqual(room.presenceUpdates, []);

    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ testGhost: "b" }]);
  });

  test("an empty payload cancels the pending report", async() => {
    const { room, sync } = setup();

    sync.local.emit("progress", "a");
    sync.local.emit("progress", "");
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});

describe("PeerPresenceGhostSync — remote peers", () => {
  test("applies a peer ghost and clears it after 1500ms without renewal", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { room, sync } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: "ghost" } });
    t.mock.timers.tick(1499);

    assert.deepStrictEqual(callsOf(sync.applied), [["peer-B", "ghost"]]);
    assert.strictEqual(sync.cleared.mock.callCount(), 0);

    t.mock.timers.tick(1);

    assert.deepStrictEqual(callsOf(sync.cleared), [["peer-B"]]);
  });

  test("ignores patches without its key or with an undecodable payload", () => {
    const { room, sync } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { somethingElse: true } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: 42 } });

    assert.strictEqual(sync.applied.mock.callCount(), 0);
  });

  test("an explicit clear removes the peer ghost", () => {
    const { room, sync } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { testGhost: null } });

    assert.deepStrictEqual(callsOf(sync.cleared), [["peer-B"]]);
  });

  test("a leaving peer's ghost is removed", () => {
    const { room, sync } = setup();

    room.emit("peer-left", { clientId: "peer-B" });

    assert.deepStrictEqual(callsOf(sync.cleared), [["peer-B"]]);
  });

  test("a snapshot clears every ghost", () => {
    const { room, sync } = setup();

    room.deliverSnapshot();

    assert.strictEqual(sync.clearedAll.mock.callCount(), 1);
  });

  test("commands are handed to reconcileCommand", () => {
    const { room, sync } = setup();
    const resized = command("resized", { size: { x: 1, y: 1 } });

    room.deliverCommand(resized);

    assert.deepStrictEqual(callsOf(sync.reconciled), [[resized]]);
  });
});

describe("PeerPresenceGhostSync — destroy", () => {
  test("removes only its own room listeners", () => {
    const room = new MockRoom();
    const left = mock.fn();
    room.on("peer-left", left);
    const { sync } = setup({}, room);

    sync.destroy();
    room.emit("peer-left", { clientId: "peer-B" });
    room.deliverCommand(command("resized", { size: { x: 1, y: 1 } }));

    assert.strictEqual(left.mock.callCount(), 1);
    assert.strictEqual(sync.reconciled.mock.callCount(), 0);
  });

  test("cancels the pending report", async() => {
    const { room, sync } = setup();

    sync.local.emit("progress", "a");
    sync.destroy();
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});
