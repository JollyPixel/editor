// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";

const kDefaultShapeIds = [
  "cube",
  "slabBottom",
  "slabTop",
  "poleY",
  "poleX",
  "poleZ",
  "poleCross",
  "ramp",
  "rampCornerInner",
  "rampCornerOuter",
  "stair",
  "stairCornerInner",
  "stairCornerOuter"
] as const;

describe("BlockShapeRegistry (empty)", () => {
  it("has returns false for any id", () => {
    const registry = new BlockShapeRegistry();
    assert.equal(registry.has("cube"), false);
  });

  it("get returns undefined for any id", () => {
    const registry = new BlockShapeRegistry();
    assert.equal(registry.get("cube"), undefined);
  });
});

describe("BlockShapeRegistry.register", () => {
  it("returns this for fluent chaining", () => {
    const registry = new BlockShapeRegistry();
    const fakeShape = { id: "myShape" as const, collisionHint: "box" as const, faces: [], occludes: () => false };
    const result = registry.register(fakeShape);
    assert.equal(result, registry);
  });

  it("shape is retrievable after registration", () => {
    const registry = new BlockShapeRegistry();
    const shape = { id: "custom" as const, collisionHint: "box" as const, faces: [], occludes: () => false };
    registry.register(shape);
    assert.equal(registry.get("custom"), shape);
    assert.equal(registry.has("custom"), true);
  });

  it("overwrites a shape with the same id", () => {
    const registry = new BlockShapeRegistry();
    const s1 = { id: "s" as const, collisionHint: "box" as const, faces: [], occludes: () => false };
    const s2 = { id: "s" as const, collisionHint: "none" as const, faces: [], occludes: () => true };
    registry.register(s1).register(s2);
    assert.equal(registry.get("s"), s2);
  });
});

describe("BlockShapeRegistry.createDefault", () => {
  it("returns a BlockShapeRegistry instance", () => {
    const registry = BlockShapeRegistry.createDefault();
    assert.ok(registry instanceof BlockShapeRegistry);
  });

  it("contains all 13 built-in shape IDs", () => {
    const registry = BlockShapeRegistry.createDefault();
    for (const id of kDefaultShapeIds) {
      assert.equal(registry.has(id), true, `expected shape "${id}" to be registered`);
    }
  });

  it("each built-in shape has a non-empty faces array", () => {
    const registry = BlockShapeRegistry.createDefault();
    for (const id of kDefaultShapeIds) {
      const shape = registry.get(id)!;
      assert.ok(shape.faces.length > 0, `shape "${id}" has no faces`);
    }
  });

  it("creates a fresh independent registry each call", () => {
    const r1 = BlockShapeRegistry.createDefault();
    const r2 = BlockShapeRegistry.createDefault();
    assert.notEqual(r1, r2);
    // Mutating r1 should not affect r2
    r1.register({ id: "only_in_r1" as const, collisionHint: "none" as const, faces: [], occludes: () => false });
    assert.equal(r2.has("only_in_r1" as any), false);
  });
});
