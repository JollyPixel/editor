// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "#src/network/types.ts";
import { makeContainer } from "../helpers/dom.ts";

/**
 * Mirrors `ServerRoom.#broadcast`, which sends to every member: it never
 * passes `excludeClientId`, so a command comes straight back to its author
 * and only `SyncAdapter`'s echo guard keeps it from being applied twice.
 */
function createEchoRoom(
  clientId = "local-client"
): network.Room<PixelNetworkCommand, PixelServerMessage> & {
  sent: PixelNetworkCommand[];
  deliver(command: PixelNetworkCommand): void;
} {
  const sent: PixelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: any) => void>>();

  function emit(
    type: string,
    payload: unknown
  ): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  function deliver(
    command: PixelNetworkCommand
  ): void {
    emit("message", { type: "command", data: command });
  }

  return {
    id: "uv-echo-room",
    clientId,
    peers: new Map(),
    sent,
    deliver,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    join() {
      // Unused here.
    },
    send(command) {
      sent.push(command);
      // The server broadcasts back to the author.
      deliver(command);
    },
    updatePresence() {
      // Unused here.
    },
    leave() {
      // Unused here.
    }
  };
}

describe("PixelSyncClient — UV region echoes", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  function attachedCanvas(
    clientId?: string
  ): {
    canvas: PixelArtCanvas;
    room: ReturnType<typeof createEchoRoom>;
    created: string[];
  } {
    const canvas = new PixelArtCanvas(container, {
      texture: { size: { x: 64, y: 64 } },
      zoom: { default: 4 }
    });
    const room = createEchoRoom(clientId);
    new PixelSyncClient({ room }).attach(canvas);

    const created: string[] = [];
    canvas.uv.on(
      "region-created",
      ({ region }) => created.push(region.id)
    );

    return { canvas, room, created };
  }

  test("creating a region broadcasts once and the echo is not re-applied", () => {
    const { canvas, room, created } = attachedCanvas();

    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });

    assert.deepStrictEqual(
      room.sent.map((command) => command.action),
      ["uv-region-created"]
    );
    assert.deepStrictEqual(
      created,
      ["cube-a"],
      "the author's own broadcast must not create a second region"
    );
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  // Regression: UVMap.restore() used to emit region-created unconditionally,
  // so a duplicate command had listeners build a second view of a region they
  // already tracked. In the examples gallery that orphaned a preview mesh in
  // the Three.js scene, which is the "one UV region, several cubes" report.
  test("a duplicated remote create updates the region instead of recreating it", () => {
    const { canvas, room, created } = attachedCanvas();

    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const [command] = room.sent;

    const stateChanges: string[] = [];
    canvas.uv.on(
      "region-state-changed",
      ({ region }) => stateChanges.push(region.id)
    );

    // Same command, but stamped by another peer so the echo guard lets it in.
    room.deliver({
      ...command,
      clientId: "other-client"
    });

    assert.deepStrictEqual(
      created,
      ["cube-a"],
      "no second creation for an id already present"
    );
    assert.deepStrictEqual(stateChanges, ["cube-a"]);
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  test("a genuinely new remote region is still created", () => {
    const { canvas, room, created } = attachedCanvas();

    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const [command] = room.sent;

    room.deliver({
      ...command,
      clientId: "other-client",
      metadata: {
        region: {
          ...command.metadata.region,
          id: "cube-b"
        }
      }
    });

    assert.deepStrictEqual(created, ["cube-a", "cube-b"]);
    assert.strictEqual([...canvas.uv.regions].length, 2);
    canvas.destroy();
  });
});
