// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network/client";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelCursorSync,
  type PixelCursorSyncOptions
} from "#src/network/PixelCursorSync.ts";
import { asCanvas } from "../helpers/canvas.ts";
import { callsOf } from "../helpers/mock.ts";
import { MockRoom } from "../helpers/room.ts";

type CursorListener = (pos: Vec2 | null) => void;

interface PeerCursorState {
  pos: Vec2 | null;
  color: string;
  label?: string;
}

function peerLabel(
  _clientId: string,
  profile: PeerMetadata
): string {
  return String(profile.username);
}

function peerColor(
  clientId: string
): string {
  return `#${clientId}`;
}

function createHost() {
  return {
    onCursorMove: undefined as CursorListener | undefined,
    peerPresence: {
      cursors: {
        set: mock.fn<(clientId: string, state: PeerCursorState) => void>(),
        remove: mock.fn<(clientId: string) => void>()
      }
    }
  };
}

function setup(
  options: Partial<Omit<PixelCursorSyncOptions, "room" | "canvas">> = {},
  room = new MockRoom()
) {
  const host = createHost();
  const sync = new PixelCursorSync({
    room,
    canvas: asCanvas(host),
    label: peerLabel,
    color: peerColor,
    ...options
  });

  return {
    room,
    host,
    cursors: host.peerPresence.cursors,
    sync
  };
}

describe("PixelCursorSync — construction", () => {
  test("renders cursors of peers already in the room", () => {
    const room = new MockRoom();
    room.addPeer("peer-B", {
      profile: { username: "Bob" },
      presence: { cursor: { x: 3, y: 4 } }
    });

    const { cursors } = setup({}, room);

    assert.strictEqual(callsOf(cursors.set).length, 1);
    const [clientId, state] = callsOf(cursors.set)[0];
    assert.strictEqual(clientId, "peer-B");
    assert.deepStrictEqual(state.pos, { x: 3, y: 4 });
    assert.strictEqual(state.label, "Bob");
  });

  test("chains the existing cursor listener and restores it on destroy", () => {
    const room = new MockRoom();
    const host = createHost();
    const previous = mock.fn<CursorListener>();
    host.onCursorMove = previous;
    const sync = new PixelCursorSync({
      room,
      canvas: asCanvas(host),
      label: peerLabel,
      color: peerColor
    });

    host.onCursorMove?.({ x: 2, y: 3 });
    sync.destroy();

    assert.deepStrictEqual(callsOf(previous), [[{ x: 2, y: 3 }]]);
    assert.strictEqual(host.onCursorMove, previous);
  });

  test("destroy removes rendered cursors and stops reporting", () => {
    const room = new MockRoom();
    room.addPeer("peer-B", { presence: { cursor: { x: 1, y: 1 } } });
    const { host, cursors, sync } = setup({}, room);

    sync.destroy();
    host.onCursorMove?.({ x: 1, y: 1 });

    assert.deepStrictEqual(callsOf(cursors.remove), [["peer-B"]]);
    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});

describe("PixelCursorSync — local cursor", () => {
  test("reports cursor moves as presence, skipping repeated positions", () => {
    const { room, host } = setup();

    host.onCursorMove?.({ x: 5, y: 6 });
    host.onCursorMove?.({ x: 5, y: 6 });
    host.onCursorMove?.(null);

    assert.deepStrictEqual(room.presenceUpdates, [
      { cursor: { x: 5, y: 6 } },
      { cursor: null }
    ]);
  });
});

describe("PixelCursorSync — remote peers", () => {
  test("renders a peer cursor from a presence patch", () => {
    const { room, cursors } = setup();
    room.addPeer("peer-B", { profile: { username: "Bob" } });

    room.emit("peer-presence", { clientId: "peer-B", patch: { cursor: { x: 1, y: 2 } } });

    const [[clientId, state]] = callsOf(cursors.set);
    assert.strictEqual(clientId, "peer-B");
    assert.deepStrictEqual(state.pos, { x: 1, y: 2 });
    assert.strictEqual(state.label, "Bob");
    assert.strictEqual(state.color, "#peer-B");
  });

  test("ignores presence patches without a cursor", () => {
    const { room, cursors } = setup();
    room.addPeer("peer-B");

    room.emit("peer-presence", { clientId: "peer-B", patch: { somethingElse: true } });

    assert.strictEqual(cursors.set.mock.callCount(), 0);
  });

  test("renders a joining peer's current cursor", () => {
    const { room, cursors } = setup();
    room.addPeer("peer-C", {
      profile: { username: "Cara" },
      presence: { cursor: { x: 7, y: 8 } }
    });

    room.emit("peer-joined", { clientId: "peer-C" });

    assert.strictEqual(callsOf(cursors.set)[0][1].label, "Cara");
  });

  test("removes a leaving peer's cursor", () => {
    const { room, cursors } = setup();
    room.addPeer("peer-B", { presence: { cursor: { x: 1, y: 1 } } });
    room.emit("peer-joined", { clientId: "peer-B" });

    room.emit("peer-left", { clientId: "peer-B" });

    assert.deepStrictEqual(callsOf(cursors.remove), [["peer-B"]]);
  });

  test("names a peer with the label option", () => {
    const { room, cursors } = setup({
      label: (_clientId, profile) => String(profile.displayName)
    });
    room.addPeer("peer-B", { profile: { displayName: "Bobby" } });

    room.emit("peer-presence", { clientId: "peer-B", patch: { cursor: { x: 0, y: 0 } } });

    assert.strictEqual(callsOf(cursors.set)[0][1].label, "Bobby");
  });

  test("uses the color option with the client id and profile", () => {
    const color = mock.fn((_clientId: string, profile: Record<string, unknown>) => String(profile.tint));
    const { room, cursors } = setup({ color });
    room.addPeer("peer-B", { profile: { tint: "#123456" } });

    room.emit("peer-presence", { clientId: "peer-B", patch: { cursor: { x: 0, y: 0 } } });

    assert.deepStrictEqual(callsOf(color), [["peer-B", { tint: "#123456" }]]);
    assert.strictEqual(callsOf(cursors.set)[0][1].color, "#123456");
  });
});

describe("PixelCursorSync — destroy", () => {
  test("removes only its own room listeners and restores the canvas", () => {
    const room = new MockRoom();
    const joined = mock.fn();
    room.on("peer-joined", joined);
    const { host, cursors, sync } = setup({}, room);

    sync.destroy();
    room.addPeer("peer-B");
    room.emit("peer-joined", { clientId: "peer-B" });

    assert.strictEqual(host.onCursorMove, undefined);
    assert.strictEqual(joined.mock.callCount(), 1);
    assert.strictEqual(cursors.set.mock.callCount(), 0);
  });
});
