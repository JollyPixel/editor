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
import {
  TRANSFORM,
  blockNode,
  folderNode
} from "../helpers/commands.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kCommands: readonly VoxelModelCommand[] = [
  {
    action: "node-added",
    node: blockNode("node-1")
  },
  {
    action: "node-removed",
    id: "node-1"
  },
  {
    action: "node-renamed",
    id: "node-1",
    name: "Renamed"
  },
  {
    action: "node-moved",
    id: "node-1",
    parentId: "node-2",
    transforms: [{ id: "node-1", transform: TRANSFORM }]
  },
  {
    action: "node-transformed",
    id: "node-1",
    transform: TRANSFORM
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
      accepts({ ...kHeader, action: "node-exploded", id: "node-1" }),
      false
    );
  });

  test("rejects a command missing a required field", () => {
    assert.strictEqual(accepts({ ...kHeader, action: "node-removed" }), false);
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-moved", id: "node-1", parentId: null }),
      false
    );
  });

  test("rejects a required field of the wrong type", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-removed", id: 42 }),
      false
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-moved",
        id: "node-1",
        parentId: 42,
        transforms: []
      }),
      false
    );
  });

  test("accepts a nullable parent", () => {
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-moved",
        id: "node-1",
        parentId: null,
        transforms: []
      }),
      true
    );
  });

  test("adds a folder or a block, told apart by kind", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-added", node: folderNode("f") }),
      true
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-added",
        node: { ...folderNode("f"), kind: "group" }
      }),
      false
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-added",
        node: { kind: "block", id: "b", parentId: null, name: "b" }
      }),
      false
    );
  });

  test("treats flipAxes on node-transformed as optional", () => {
    const command = {
      ...kHeader,
      action: "node-transformed",
      id: "node-1",
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
