// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelModelCommandProtocol } from "#src/network/VoxelModelCommand.schema.ts";
import { TRANSFORM, UV } from "../helpers/commands.ts";

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

const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

describe("voxelModelCommandProtocol", () => {
  test("takes a material removal that keeps a folder's contents", () => {
    const command = {
      ...kHeader,
      action: "material-removed",
      id: "folder-1"
    };

    assert.strictEqual(accepts({ ...command, keepContents: true }), true);
    assert.strictEqual(accepts({ ...command, keepContents: "yes" }), false);
  });

  test("takes a partial material surface but not an empty one or an unknown field", () => {
    const command = {
      ...kHeader,
      action: "material-changed",
      id: "material-1"
    };

    assert.strictEqual(accepts({ ...command, surface: { roughness: 0.2 } }), true);
    assert.strictEqual(accepts({ ...command, surface: {} }), false);
    assert.strictEqual(accepts({ ...command, surface: { shine: 1 } }), false);
  });

  test("rejects a UV change without a valid layout", () => {
    const command = {
      ...kHeader,
      action: "node-uv-changed",
      id: "node-1"
    };

    assert.strictEqual(accepts(command), false);
    assert.strictEqual(
      accepts({ ...command, uv: { state: "unfolded" } }),
      false
    );
  });

  test("rejects a shape change to an unknown shape or without its UV layout", () => {
    const command = {
      ...kHeader,
      action: "node-shape-changed",
      id: "node-1",
      shape: { type: "plane" },
      uv: UV
    };

    assert.strictEqual(accepts(command), true);
    assert.strictEqual(accepts({ ...command, shape: { type: "blob" } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "plane", sides: 4 } }), false);
    assert.strictEqual(accepts({ ...command, uv: undefined }), false);
  });

  test("takes round shapes with a whole number of 3 to 32 sides, and sides on round shapes only", () => {
    const command = {
      ...kHeader,
      action: "node-shape-changed",
      id: "node-1",
      uv: UV
    };

    assert.strictEqual(accepts({ ...command, shape: { type: "cone", sides: 4 } }), true);
    assert.strictEqual(accepts({ ...command, shape: { type: "cylinder", sides: 32 } }), true);
    assert.strictEqual(accepts({ ...command, shape: { type: "cylinder", sides: 2 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "cylinder", sides: 33 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "cone", sides: 4.5 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "cone" } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "box", sides: 4 } }), false);
  });

  test("takes a torus with its ring sides and a thickness from 0.05 to 0.95", () => {
    const command = {
      ...kHeader,
      action: "node-shape-changed",
      id: "node-1",
      uv: UV
    };
    const torus = { type: "torus", sides: 8, ringSides: 6, thickness: 0.35 };

    assert.strictEqual(accepts({ ...command, shape: torus }), true);
    assert.strictEqual(accepts({ ...command, shape: { ...torus, ringSides: 2 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { ...torus, thickness: 0.96 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { ...torus, thickness: 0.04 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "torus", sides: 8 } }), false);
    assert.strictEqual(accepts({ ...command, shape: { type: "cylinder", sides: 8, thickness: 0.5 } }), false);
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
