// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelModelCommandProtocol } from "#src/network/VoxelModelCommand.schema.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import { TRANSFORM } from "../helpers/commands.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kCommands: readonly VoxelModelCommand[] = [
  {
    action: "group-added",
    uuid: "group-1",
    name: "Group",
    transform: TRANSFORM
  },
  {
    action: "group-removed",
    uuid: "group-1"
  },
  {
    action: "group-renamed",
    uuid: "group-1",
    name: "Renamed"
  },
  {
    action: "group-reparented",
    uuid: "group-1",
    parentUuid: null,
    transform: TRANSFORM
  },
  {
    action: "group-reparented-local",
    uuid: "group-1",
    parentUuid: "group-2"
  },
  {
    action: "group-transformed",
    uuid: "group-1",
    transform: TRANSFORM
  },
  {
    action: "folder-added",
    uuid: "folder-1",
    name: "Folder",
    parentId: null
  },
  {
    action: "folder-removed",
    uuid: "folder-1"
  },
  {
    action: "folder-renamed",
    uuid: "folder-1",
    name: "Renamed"
  },
  {
    action: "folder-reparented",
    uuid: "folder-1",
    parentId: "folder-2"
  },
  {
    action: "block-placed",
    blockUuid: "block-1",
    folderId: "folder-1"
  },
  {
    action: "block-unplaced",
    blockUuid: "block-1"
  }
];

function parse(
  payload: unknown
) {
  return new MessageParser(voxelModelCommandProtocol).parse(payload);
}

function accepts(
  payload: unknown
): boolean {
  return parse(payload).ok;
}

describe("voxelModelCommandProtocol", () => {
  test("declares one event per command action", () => {
    assert.deepStrictEqual(
      new MessageParser(voxelModelCommandProtocol).events,
      kCommands.map((command) => command.action)
    );
  });

  for (const command of kCommands) {
    test(`parses ${command.action} to its action`, () => {
      const parsed = parse({ ...kHeader, ...command });

      assert.strictEqual(parsed.ok, true);
      assert.strictEqual(parsed.val.event, command.action);
    });

    test(`rejects ${command.action} without a network header`, () => {
      assert.strictEqual(accepts(command), false);
    });
  }

  test("rejects an unknown action", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "group-exploded", uuid: "group-1" }),
      false
    );
  });

  test("rejects a command missing a required field", () => {
    assert.strictEqual(accepts({ ...kHeader, action: "group-removed" }), false);
    assert.strictEqual(
      accepts({ ...kHeader, action: "block-placed", blockUuid: "block-1" }),
      false
    );
  });

  test("rejects a required field of the wrong type", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "group-removed", uuid: 42 }),
      false
    );
    assert.strictEqual(
      accepts({ ...kHeader, action: "folder-reparented", uuid: "folder-1", parentId: 42 }),
      false
    );
  });

  test("accepts a nullable parent on both folder and group commands", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "folder-reparented", uuid: "folder-1", parentId: null }),
      true
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "group-reparented",
        uuid: "group-1",
        parentUuid: null,
        transform: TRANSFORM
      }),
      true
    );
  });

  test("treats flipAxes on group-transformed as optional", () => {
    const command = {
      ...kHeader,
      action: "group-transformed",
      uuid: "group-1",
      transform: TRANSFORM
    };

    assert.strictEqual(accepts(command), true);
    assert.strictEqual(
      accepts({
        ...command,
        flipAxes: { x: true, y: false, z: true }
      }),
      true
    );
    assert.strictEqual(
      accepts({
        ...command,
        flipAxes: { x: true, y: false }
      }),
      false
    );
  });
});
