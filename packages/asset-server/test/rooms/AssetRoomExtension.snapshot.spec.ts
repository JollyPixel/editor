// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  type AssetLiveProtocol
} from "#src/index.ts";
import { counterSnapshotSchema } from "../helpers/protocols.ts";
import {
  counterRoomBinding,
  counterRoomCommands,
  recordingClient,
  recordingRoom,
  roomPeer
} from "../helpers/rooms.ts";

interface Command {
  action: string;
}

interface SnapshotRoom {
  readonly extension: AssetRoomExtension<Command>;
  readonly encodes: number;
  version: number;
  join(clientId: string): Promise<unknown[]>;
}

function snapshotRoom(
  encodeSnapshot: (room: SnapshotRoom) => Promise<unknown>
): SnapshotRoom {
  let encodes = 0;
  const protocol: AssetLiveProtocol<Command> = {
    snapshotSchema: counterSnapshotSchema,
    snapshot: () => {
      return { value: `plain@${room.version}` };
    },
    encodeSnapshot: () => {
      encodes++;

      return encodeSnapshot(room);
    },
    arbitrate: (command) => {
      return { command };
    }
  };
  const extension = new AssetRoomExtension<Command>(
    counterRoomBinding({ version: () => room.version }),
    counterRoomCommands<Command>(),
    protocol,
    {
      append: () => {
        throw new Error("unexpected append");
      }
    }
  );

  const { context } = recordingRoom();
  const room: SnapshotRoom = {
    extension,
    version: 1,
    get encodes() {
      return encodes;
    },
    async join(clientId) {
      const handle = recordingClient(clientId);
      await extension.onClientConnect(handle, roomPeer(clientId), context);

      return handle.received;
    }
  };

  return room;
}

describe("AssetRoomExtension — encoded snapshots", () => {
  test("a join receives the encoded snapshot of the current version", async() => {
    const room = snapshotRoom(async(current) => {
      return { value: `encoded@${current.version}` };
    });

    assert.deepEqual(await room.join("a"), [
      { type: "snapshot", data: { value: "encoded@1" }, version: 1 }
    ]);
  });

  test("joins at the same version share one encode", async() => {
    const room = snapshotRoom(async(current) => {
      return { value: `encoded@${current.version}` };
    });

    await room.join("a");
    await room.join("b");
    room.version = 2;
    const received = await room.join("c");

    assert.strictEqual(room.encodes, 2);
    assert.deepEqual(received, [
      { type: "snapshot", data: { value: "encoded@2" }, version: 2 }
    ]);
  });

  test("a version change during the encode sends the plain snapshot", async() => {
    const room = snapshotRoom(async(current) => {
      const encoded = { value: `encoded@${current.version}` };
      current.version++;

      return encoded;
    });

    assert.deepEqual(await room.join("a"), [
      { type: "snapshot", data: { value: "plain@2" }, version: 2 }
    ]);
  });

  test("a failed encode falls back to the plain snapshot", async() => {
    const room = snapshotRoom(() => Promise.reject(new Error("encode failed")));

    assert.deepEqual(await room.join("a"), [
      { type: "snapshot", data: { value: "plain@1" }, version: 1 }
    ]);
  });

  test("a resync at the encoded version reuses the encoded snapshot", async() => {
    const room = snapshotRoom(async(current) => {
      return { value: `encoded@${current.version}` };
    });
    await room.join("a");
    const resync = recordingRoom();

    room.extension.onResync("a", resync.context);

    assert.deepEqual(resync.direct.map(({ payload }) => payload), [
      { type: "snapshot", data: { value: "encoded@1" }, version: 1 }
    ]);
  });
});
