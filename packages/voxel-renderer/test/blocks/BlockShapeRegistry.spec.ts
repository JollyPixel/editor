// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import type { BlockShape } from "../../src/blocks/BlockShape.ts";

// CONSTANTS
const kDefaultShapeIds = [
  "cube",
  "slabBottom",
  "slabTop",
  "poleY",
  "pole",
  "ramp",
  "rampCornerInner",
  "rampCornerOuter",
  "stair",
  "stairCornerInner",
  "stairCornerOuter"
] as const;

function makeShape(
  id: string
): BlockShape {
  return {
    id,
    collisionHint: "box",
    faces: [],
    occludes: () => false
  };
}

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
    const fakeShape = {
      id: "myShape",
      collisionHint: "box" as const,
      faces: [],
      occludes: () => false
    };
    const result = registry.register(fakeShape);
    assert.equal(result, registry);
  });

  it("shape is retrievable after registration", () => {
    const registry = new BlockShapeRegistry();
    const shape = {
      id: "custom",
      collisionHint: "box" as const,
      faces: [],
      occludes: () => false
    };
    registry.register(shape);
    assert.equal(registry.get("custom"), shape);
    assert.equal(registry.has("custom"), true);
  });

  it("overwrites a shape with the same id", () => {
    const registry = new BlockShapeRegistry();
    const s1 = {
      id: "s",
      collisionHint: "box" as const,
      faces: [],
      occludes: () => false
    };
    const s2 = {
      id: "s",
      collisionHint: "none" as const,
      faces: [],
      occludes: () => true
    };
    registry.register(s1).register(s2);
    assert.equal(registry.get("s"), s2);
  });
});

describe("BlockShapeRegistry.createDefault", () => {
  it("returns a BlockShapeRegistry instance", () => {
    const registry = BlockShapeRegistry.createDefault();
    assert.ok(registry instanceof BlockShapeRegistry);
  });

  it("contains all 11 built-in shape IDs", () => {
    const registry = BlockShapeRegistry.createDefault();
    for (const id of kDefaultShapeIds) {
      assert.equal(
        registry.has(id),
        true,
        `expected shape "${id}" to be registered`
      );
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
    r1.register({
      id: "only_in_r1",
      collisionHint: "none",
      faces: [],
      occludes: () => false
    });
    assert.equal(r2.has("only_in_r1"), false);
  });
});

describe("BlockShapeRegistry.getAll", () => {
  it("is empty for a fresh registry", () => {
    const registry = new BlockShapeRegistry();
    assert.deepEqual([...registry.getAll()], []);
  });

  it("yields the registered shapes in registration order", () => {
    const registry = new BlockShapeRegistry();
    const first = makeShape("first");
    const second = makeShape("second");
    registry.register(first).register(second);

    assert.deepEqual([...registry.getAll()], [first, second]);
  });

  it("keeps the original position when a shape is overwritten", () => {
    const registry = new BlockShapeRegistry();
    const replacement = makeShape("first");
    registry
      .register(makeShape("first"))
      .register(makeShape("second"))
      .register(replacement);

    assert.deepEqual(
      [...registry.getAll()].map((shape) => shape.id),
      ["first", "second"]
    );
    assert.equal([...registry.getAll()][0], replacement);
  });
});

describe("BlockShapeRegistry[Symbol.iterator]", () => {
  it("yields the same shapes as getAll", () => {
    const registry = new BlockShapeRegistry();
    registry.register(makeShape("first")).register(makeShape("second"));

    assert.deepEqual([...registry], [...registry.getAll()]);
  });

  it("is iterable with for...of", () => {
    const registry = new BlockShapeRegistry();
    registry.register(makeShape("only"));

    const ids: string[] = [];
    for (const shape of registry) {
      ids.push(shape.id);
    }

    assert.deepEqual(ids, ["only"]);
  });
});

describe("BlockShapeRegistry.ids", () => {
  it("is empty for a fresh registry", () => {
    const registry = new BlockShapeRegistry();
    assert.deepEqual([...registry.ids()], []);
  });

  it("yields every built-in shape id for the default registry", () => {
    const registry = BlockShapeRegistry.createDefault();
    assert.deepEqual([...registry.ids()], [...kDefaultShapeIds]);
  });

  it("includes a custom shape registered after createDefault", () => {
    const registry = BlockShapeRegistry.createDefault();
    registry.register(makeShape("myShape"));

    assert.deepEqual(
      [...registry.ids()],
      [...kDefaultShapeIds, "myShape"]
    );
  });
});

describe("BlockShapeRegistry version", () => {
  it("starts at 0 and increments on every register", () => {
    const registry = new BlockShapeRegistry();
    assert.equal(registry.version, 0);

    registry.register({
      id: "custom",
      collisionHint: "box",
      faces: [],
      occludes: () => false
    });
    assert.equal(registry.version, 1);
  });
});
