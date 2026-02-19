// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";

function makeDef(id: number, name = `Block${id}`) {
  return {
    id,
    name,
    shapeId: "fullCube" as const,
    faceTextures: {},
    defaultTexture: { col: 0, row: 0, tilesetId: "atlas" },
    collidable: true
  };
}

describe("BlockRegistry constructor", () => {
  it("starts empty with no args", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.has(1), false);
  });

  it("registers defs provided in constructor", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2)]);
    assert.equal(registry.has(1), true);
    assert.equal(registry.has(2), true);
  });

  it("silently skips id=0 in constructor defs", () => {
    const registry = new BlockRegistry([makeDef(0), makeDef(1)]);
    assert.equal(registry.has(0), false);
    assert.equal(registry.has(1), true);
  });
});

describe("BlockRegistry.register", () => {
  it("returns this for fluent chaining", () => {
    const registry = new BlockRegistry();
    const result = registry.register(makeDef(1));
    assert.equal(result, registry);
  });

  it("throws when id is 0", () => {
    const registry = new BlockRegistry();
    assert.throws(
      () => registry.register(makeDef(0)),
      /Block ID 0 is reserved/
    );
  });

  it("overwrites an existing def with the same id", () => {
    const registry = new BlockRegistry();
    registry.register(makeDef(1, "Old"));
    registry.register(makeDef(1, "New"));
    assert.equal(registry.get(1)?.name, "New");
  });
});

describe("BlockRegistry.get", () => {
  it("returns the registered def", () => {
    const registry = new BlockRegistry();
    const def = makeDef(5);
    registry.register(def);
    assert.equal(registry.get(5), def);
  });

  it("returns undefined for unknown id", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.get(99), undefined);
  });
});

describe("BlockRegistry.has", () => {
  it("returns true for registered id", () => {
    const registry = new BlockRegistry([makeDef(3)]);
    assert.equal(registry.has(3), true);
  });

  it("returns false for unregistered id", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.has(3), false);
  });
});

describe("BlockRegistry.getAll", () => {
  it("iterates all registered defs", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);
    const all = [...registry.getAll()];
    assert.equal(all.length, 3);
    const ids = new Set(all.map((d) => d.id));
    assert.deepEqual(ids, new Set([1, 2, 3]));
  });

  it("returns empty iterator for empty registry", () => {
    const registry = new BlockRegistry();
    const all = [...registry.getAll()];
    assert.equal(all.length, 0);
  });
});
