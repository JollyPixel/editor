// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelProtocols } from "#src/network/VoxelCommand.schema.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";

describe("voxelProtocols", () => {
  test("parses a command to its action", () => {
    const parser = new MessageParser(voxelProtocols.inbound!);

    const parsed = parser.parse(voxelSetCmd());

    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "voxel-set");
  });

  test("rejects a payload that is not a voxel command", () => {
    const parser = new MessageParser(voxelProtocols.inbound!);

    assert.strictEqual(parser.parse({ not: "a command" }).ok, false);
  });
});
