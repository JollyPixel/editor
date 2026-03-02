// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { BlockDefinitionIn } from "../../src/blocks/BlockDefinition.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { FACE } from "../../src/utils/math.ts";

function makeDef(id: number, name = `Block${id}`): BlockDefinitionIn {
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

  it("returns the registered def with transformed face textures", () => {
    const registry = new BlockRegistry();
    const def = makeDef(5);
    def.faceTextures[FACE.NegY] = [1, 2];
    def.faceTextures[FACE.NegZ] = [3, 4];
    def.faceTextures[FACE.PosY] = { col: 5, row: 6 };
    def.defaultTilesetId = "terrain";
    def.defaultTexture = [5, 6];
    registry.register(def);
    assert.deepEqual(registry.get(5), {
      ...makeDef(5),
      defaultTexture: { col: 5, row: 6, tilesetId: "terrain" },
      faceTextures: {
        [FACE.NegY]: { col: 1, row: 2, tilesetId: "terrain" },
        [FACE.NegZ]: { col: 3, row: 4, tilesetId: "terrain" },
        [FACE.PosY]: { col: 5, row: 6, tilesetId: "terrain" }
      }
    });
  });

  it("should add default tile set id to default texture", () => {
    const registry = new BlockRegistry();
    const def = makeDef(5);
    def.defaultTilesetId = "terrain";
    def.defaultTexture = { col: 5, row: 6 };
    registry.register(def);
    assert.deepEqual(registry.get(5), {
      ...makeDef(5),
      defaultTexture: { col: 5, row: 6, tilesetId: "terrain" }

    });
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
