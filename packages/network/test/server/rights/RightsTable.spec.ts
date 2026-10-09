// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  RightsTable
} from "#src/index.ts";

describe("RightsTable — unconfigured", () => {
  test("is not configured when constructed without a table", () => {
    assert.strictEqual(new RightsTable().configured, false);
  });

  test("is not configured when constructed with an empty table", () => {
    assert.strictEqual(new RightsTable({}).configured, false);
  });

  test("check() fails open to \"write\" for any role/event", () => {
    const table = new RightsTable();

    assert.strictEqual(table.check("viewer", "voxel-set"), "write");
    assert.strictEqual(table.check("anything", "anything"), "write");
  });
});

describe("RightsTable — configured", () => {
  test("is configured when constructed with at least one role", () => {
    const table = new RightsTable({ viewer: { "voxel-set": "read" } });

    assert.strictEqual(table.configured, true);
  });

  test("check() returns the configured right for a known role/event", () => {
    const table = new RightsTable({
      viewer: { "voxel-set": "read" },
      editor: { "voxel-set": "write" }
    });

    assert.strictEqual(table.check("viewer", "voxel-set"), "read");
    assert.strictEqual(table.check("editor", "voxel-set"), "write");
  });

  test("check() denies a role absent from a configured table", () => {
    const table = new RightsTable({ viewer: { "voxel-set": "void" } });

    assert.strictEqual(table.check("unknown-role", "voxel-set"), "void");
  });

  test("check() denies a known role an unlisted event", () => {
    const table = new RightsTable({ viewer: { "voxel-set": "write" } });

    assert.strictEqual(table.check("viewer", "object-added"), "void");
  });

  test("check() grants an unlisted event through an explicit \"*\" catch-all", () => {
    const table = new RightsTable({
      viewer: {
        "voxel-set": "void",
        "*": "write"
      }
    });

    assert.strictEqual(table.check("viewer", "object-added"), "write");
  });
});
