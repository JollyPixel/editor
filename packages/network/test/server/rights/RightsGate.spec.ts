// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RightsTable } from "#src/index.ts";

describe("RightsGate", () => {
  test("prefixes the event with its namespace before looking it up", () => {
    const gate = new RightsTable({
      viewer: { "voxel.renderer.voxel-set": "read" }
    }).scope("voxel.renderer");

    assert.strictEqual(gate.check("viewer", "voxel-set"), "read");
  });

  test("does not match a rule written for another namespace", () => {
    const gate = new RightsTable({
      viewer: { "pixel-draw.voxel-set": "void" }
    }).scope("voxel.renderer");

    assert.strictEqual(gate.check("viewer", "voxel-set"), "write");
  });

  test("mirrors the underlying table's configured flag", () => {
    assert.strictEqual(new RightsTable().scope("any").configured, false);
    assert.strictEqual(
      new RightsTable({ viewer: { "any.thing": "read" } }).scope("any").configured,
      true
    );
  });

  test("canWrite() is true only for the \"write\" right", () => {
    const gate = new RightsTable({
      viewer: {
        "voxel.renderer.voxel-set": "read",
        "voxel.renderer.object-added": "void",
        "voxel.renderer.$join": "write"
      }
    }).scope("voxel.renderer");

    assert.strictEqual(gate.canWrite("viewer", "voxel-set"), false);
    assert.strictEqual(gate.canWrite("viewer", "object-added"), false);
    assert.strictEqual(gate.canWrite("viewer", "$join"), true);
  });

  test("canWrite() fails open for an unconfigured table", () => {
    const gate = new RightsTable().scope("voxel.renderer");

    assert.strictEqual(gate.canWrite("viewer", "voxel-set"), true);
  });
});
