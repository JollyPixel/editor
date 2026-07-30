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

  test("check() fails open to \"write\" for an unknown role", () => {
    const table = new RightsTable({ viewer: { "voxel-set": "void" } });

    assert.strictEqual(table.check("unknown-role", "voxel-set"), "write");
  });

  test("check() fails open to \"write\" for a known role with an unlisted event", () => {
    const table = new RightsTable({ viewer: { "voxel-set": "void" } });

    assert.strictEqual(table.check("viewer", "object-added"), "write");
  });
});

describe("RightsTable — glob patterns", () => {
  test("a trailing \"*\" matches any suffix, letting one rule cover a whole namespace", () => {
    const table = new RightsTable({ viewer: { "voxel.renderer.*": "read" } });

    assert.strictEqual(table.check("viewer", "voxel.renderer.voxel-set"), "read");
    assert.strictEqual(table.check("viewer", "voxel.renderer.object-added"), "read");
  });

  test("a literal \".\" in the pattern only matches a literal \".\", not \"any character\"", () => {
    const table = new RightsTable({ viewer: { "voxel.renderer.voxel-set": "read" } });

    assert.strictEqual(table.check("viewer", "voxelXrendererXvoxel-set"), "write");
  });

  test("\"*\" matches across namespace separators too, not just within one segment", () => {
    const table = new RightsTable({ viewer: { "*.$join": "void" } });

    assert.strictEqual(table.check("viewer", "voxel.renderer.$join"), "void");
    assert.strictEqual(table.check("viewer", "pixel-draw.$join"), "void");
  });

  test("the first pattern that matches wins, in declaration order", () => {
    const table = new RightsTable({
      viewer: {
        "voxel.renderer.voxel-set": "write",
        "voxel.renderer.*": "void"
      }
    });

    assert.strictEqual(table.check("viewer", "voxel.renderer.voxel-set"), "write");
    assert.strictEqual(table.check("viewer", "voxel.renderer.object-added"), "void");
  });
});
