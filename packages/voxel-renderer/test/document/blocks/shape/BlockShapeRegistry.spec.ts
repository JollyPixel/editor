// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type BlockShape, BlockShapeRegistry } from "../../../../src/document/blocks/shape/index.ts";

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
  it("knows no shape until one is registered", () => {
    const registry = new BlockShapeRegistry();

    assert.equal(registry.has("cube"), false);
    assert.equal(registry.get("cube"), undefined);
    assert.deepEqual([...registry.getAll()], []);
    assert.deepEqual([...registry.ids()], []);
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

describe("BlockShapeRegistry.registerMany", () => {
  it("registers every shape and returns the registry", () => {
    const registry = new BlockShapeRegistry();
    const first = makeShape("first");
    const second = makeShape("second");

    const returned = registry.registerMany([first, second]);

    assert.equal(returned, registry);
    assert.equal(registry.get("first"), first);
    assert.equal(registry.get("second"), second);
  });

  it("replaces a shape already using the same id", () => {
    const registry = new BlockShapeRegistry();
    const replacement = makeShape("first");
    registry.register(makeShape("first"));

    registry.registerMany([replacement]);

    assert.equal(registry.get("first"), replacement);
  });

  it("bumps the version once per shape", () => {
    const registry = new BlockShapeRegistry();

    registry.registerMany([makeShape("first"), makeShape("second")]);

    assert.equal(registry.version, 2);
  });

  it("accepts any iterable, not just an array", () => {
    const registry = new BlockShapeRegistry();

    registry.registerMany(new Set([makeShape("first"), makeShape("second")]));

    assert.deepEqual([...registry.ids()], ["first", "second"]);
  });

  it("leaves the registry untouched for an empty iterable", () => {
    const registry = new BlockShapeRegistry();

    registry.registerMany([]);

    assert.deepEqual([...registry.getAll()], []);
    assert.equal(registry.version, 0);
  });
});

describe("BlockShapeRegistry.createDefault", () => {
  it("creates a fresh independent registry each call", () => {
    const r1 = BlockShapeRegistry.createDefault();
    const r2 = BlockShapeRegistry.createDefault();
    assert.notEqual(r1, r2);
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
});

describe("BlockShapeRegistry.ids", () => {
  it("includes a custom shape registered after createDefault", () => {
    const registry = BlockShapeRegistry.createDefault();
    const builtIn = [...registry.ids()];
    registry.register(makeShape("myShape"));

    assert.deepEqual([...registry.ids()], [...builtIn, "myShape"]);
  });
});
