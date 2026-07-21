// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelWorld } from "#src/network/PixelWorld.ts";

describe("PixelWorld", () => {
  describe("addBuffer / getBuffer / hasBuffer", () => {
    test("registers a buffer retrievable by id", () => {
      const world = new PixelWorld();
      const buffer = world.addBuffer(
        "tex1",
        { size: { x: 4, y: 4 } }
      );

      assert.ok(world.hasBuffer("tex1"));
      assert.strictEqual(world.getBuffer("tex1"), buffer);
    });

    test("throws when the id is already registered", () => {
      const world = new PixelWorld();
      world.addBuffer("tex1", { size: { x: 4, y: 4 } });

      assert.throws(() => world.addBuffer(
        "tex1",
        { size: { x: 4, y: 4 } }
      ));
    });

    test("getBuffer returns undefined for an unknown id", () => {
      const world = new PixelWorld();
      assert.strictEqual(world.getBuffer("missing"), undefined);
    });
  });

  describe("removeBuffer", () => {
    test("removes a registered buffer", () => {
      const world = new PixelWorld();
      world.addBuffer(
        "tex1",
        { size: { x: 4, y: 4 } }
      );
      world.removeBuffer("tex1");

      assert.ok(!world.hasBuffer("tex1"));
    });

    test("is a no-op for an unknown id", () => {
      const world = new PixelWorld();
      assert.doesNotThrow(() => world.removeBuffer("missing"));
    });
  });

  describe("getBufferIds", () => {
    test("returns a lazy iterable over every registered id, not an array", () => {
      const world = new PixelWorld();
      world.addBuffer(
        "tex1",
        { size: { x: 4, y: 4 } }
      );
      world.addBuffer(
        "tex2",
        { size: { x: 4, y: 4 } }
      );

      const ids = world.getBufferIds();
      assert.ok(!Array.isArray(ids));
      assert.strictEqual(typeof ids[Symbol.iterator], "function");
      assert.deepStrictEqual([...ids].sort(), ["tex1", "tex2"]);
    });

    test("reflects removals", () => {
      const world = new PixelWorld();
      world.addBuffer(
        "tex1",
        { size: { x: 4, y: 4 } }
      );
      world.removeBuffer("tex1");

      assert.deepStrictEqual([...world.getBufferIds()], []);
    });
  });
});
