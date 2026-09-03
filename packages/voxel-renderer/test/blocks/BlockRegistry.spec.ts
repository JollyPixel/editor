// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { BlockDefinition } from "../../src/blocks/BlockDefinition.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { FACE } from "../../src/utils/math.ts";
import {
  DEFAULT_TEXTURE,
  makeBlockDef
} from "../helpers/blocks.ts";

function makeDef(
  id: number,
  name = `Block${id}`
): BlockDefinition {
  return {
    id,
    name,
    shapeId: "fullCube",
    faceTextures: {},
    defaultTexture: {
      ...DEFAULT_TEXTURE,
      tilesetId: "atlas"
    },
    collidable: true
  };
}

describe("BlockRegistry constructor", () => {
  it("starts empty with no args", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.has(1), false);
  });

  it("registers defs provided in constructor", () => {
    const registry = new BlockRegistry([
      makeDef(1),
      makeDef(2)
    ]);
    assert.equal(registry.has(1), true);
    assert.equal(registry.has(2), true);
  });

  it("throws on an air definition, like register does", () => {
    assert.throws(
      () => new BlockRegistry([makeDef(1), makeDef(0)]),
      /Block id 0 is reserved/
    );
  });
});

describe("BlockRegistry registerMany", () => {
  it("registers every definition and returns the registry", () => {
    const registry = new BlockRegistry();

    const returned = registry.registerMany([makeDef(1), makeDef(2)]);

    assert.equal(returned, registry);
    assert.equal(registry.has(1), true);
    assert.equal(registry.has(2), true);
  });

  it("replaces an existing id by default", () => {
    const registry = new BlockRegistry([makeDef(1, "first")]);

    registry.registerMany([makeDef(1, "second")]);

    assert.equal(registry.get(1)?.name, "second");
  });

  it("keeps the existing registration when skipExisting is set", () => {
    const registry = new BlockRegistry([makeDef(1, "first")]);

    registry.registerMany(
      [makeDef(1, "second"), makeDef(2, "new")],
      { skipExisting: true }
    );

    assert.equal(registry.get(1)?.name, "first");
    assert.equal(registry.get(2)?.name, "new");
  });

  it("does not bump the version for a skipped definition", () => {
    const registry = new BlockRegistry([makeDef(1)]);
    const { version } = registry;

    registry.registerMany([makeDef(1)], { skipExisting: true });

    assert.equal(registry.version, version);
  });

  it("accepts any iterable, not just an array", () => {
    const registry = new BlockRegistry();

    registry.registerMany(new Set([makeDef(1), makeDef(2)]));

    assert.equal(registry.has(2), true);
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
      /Block id 0 is reserved/
    );
  });

  it("overwrites an existing def with the same id", () => {
    const registry = new BlockRegistry();
    registry.register(makeDef(1, "Old"));
    registry.register(makeDef(1, "New"));
    assert.equal(registry.get(1)?.name, "New");
  });
});

describe("BlockRegistry.register — defaults", () => {
  it("treats an omitted collidable as true", () => {
    const registry = new BlockRegistry();
    registry.register({ id: 1, name: "A", shapeId: "cube" });

    assert.equal(registry.get(1)!.collidable, true);
  });

  it("keeps an explicit collidable of false", () => {
    const registry = new BlockRegistry();
    registry.register({
      id: 1,
      name: "A",
      shapeId: "cube",
      collidable: false
    });

    assert.equal(registry.get(1)!.collidable, false);
  });

  it("treats omitted faceTextures as none", () => {
    const registry = new BlockRegistry();
    registry.register({ id: 1, name: "A", shapeId: "cube" });

    assert.deepEqual(registry.get(1)!.faceTextures, {});
  });

  it("stores a block authored with nothing but its identity", () => {
    const registry = new BlockRegistry();
    registry.register({ id: 1, name: "A", shapeId: "cube" });

    assert.deepEqual(registry.get(1), {
      id: 1,
      name: "A",
      shapeId: "cube",
      collidable: true,
      faceTextures: {}
    });
  });

  it("leaves the authored definition untouched", () => {
    const registry = new BlockRegistry();
    const def: BlockDefinition = {
      id: 1,
      name: "A",
      shapeId: "cube",
      faceTextures: {
        [FACE.PosY]: [1, 2]
      },
      defaultTexture: { col: 0, row: 0 },
      defaultTilesetId: "atlas"
    };

    registry.register(def);

    assert.deepEqual(def, {
      id: 1,
      name: "A",
      shapeId: "cube",
      faceTextures: {
        [FACE.PosY]: [1, 2]
      },
      defaultTexture: { col: 0, row: 0 },
      defaultTilesetId: "atlas"
    });
  });

  it("still resolves a bare tile ref tuple against defaultTilesetId", () => {
    const registry = new BlockRegistry();
    registry.register({
      id: 1,
      name: "A",
      shapeId: "cube",
      defaultTexture: [2, 3],
      defaultTilesetId: "atlas"
    });

    assert.deepEqual(registry.get(1)!.defaultTexture, {
      col: 2,
      row: 3,
      tilesetId: "atlas"
    });
  });
});

describe("BlockRegistry.get", () => {
  it("returns the registered def", () => {
    const registry = new BlockRegistry();
    registry.register(makeDef(5));
    assert.deepEqual(registry.get(5), makeDef(5));
  });

  it("returns undefined for unknown id", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.get(99), undefined);
  });

  it("returns the registered def with transformed face textures", () => {
    const registry = new BlockRegistry();
    const def = makeDef(5);
    def.faceTextures = {};
    def.faceTextures[FACE.NegY] = [1, 2];
    def.faceTextures[FACE.NegZ] = [3, 4];
    def.faceTextures[FACE.PosY] = { col: 5, row: 6 };
    def.defaultTilesetId = "terrain";
    def.defaultTexture = [5, 6];
    registry.register(def);
    assert.deepEqual(registry.get(5), {
      ...makeDef(5),
      defaultTexture: {
        col: 5,
        row: 6,
        tilesetId: "terrain"
      },
      faceTextures: {
        [FACE.NegY]: {
          col: 1,
          row: 2,
          tilesetId: "terrain"
        },
        [FACE.NegZ]: {
          col: 3,
          row: 4,
          tilesetId: "terrain"
        },
        [FACE.PosY]: {
          col: 5,
          row: 6,
          tilesetId: "terrain"
        }
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
      defaultTexture: {
        col: 5,
        row: 6,
        tilesetId: "terrain"
      }
    });
  });
});

describe("BlockRegistry.has", () => {
  it("returns true for registered id", () => {
    const registry = new BlockRegistry([
      makeDef(3)
    ]);
    assert.equal(registry.has(3), true);
  });

  it("returns false for unregistered id", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.has(3), false);
  });
});

describe("BlockRegistry.getAll", () => {
  it("iterates all registered defs", () => {
    const registry = new BlockRegistry([
      makeDef(1),
      makeDef(2),
      makeDef(3)
    ]);

    const all = [...registry.getAll()];
    assert.equal(all.length, 3);

    const ids = new Set(all.map((definition) => definition.id));
    assert.deepEqual(ids, new Set([1, 2, 3]));
  });

  it("returns empty iterator for empty registry", () => {
    const registry = new BlockRegistry();
    const all = [...registry.getAll()];
    assert.equal(all.length, 0);
  });
});

describe("BlockRegistry[Symbol.iterator]", () => {
  it("yields the same defs as getAll", () => {
    const registry = new BlockRegistry([
      makeDef(1),
      makeDef(2)
    ]);

    assert.deepEqual([...registry], [...registry.getAll()]);
  });

  it("is iterable with for...of", () => {
    const registry = new BlockRegistry([makeDef(4)]);

    const ids: number[] = [];
    for (const definition of registry) {
      ids.push(definition.id);
    }

    assert.deepEqual(ids, [4]);
  });
});

describe("BlockRegistry.nextId", () => {
  it("is one for an empty registry, never zero (air)", () => {
    assert.equal(new BlockRegistry().nextId, 1);
  });

  it("sits above the highest identifier, whatever the order", () => {
    const registry = new BlockRegistry();
    registry
      .register(makeDef(4))
      .register(makeDef(9))
      .register(makeDef(2));

    assert.equal(registry.nextId, 10);
  });

  it("counts definitions registered through the constructor", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(3)]);

    assert.equal(registry.nextId, 4);
  });

  it("stays at one when a rejected air definition aborts the constructor", () => {
    assert.throws(() => new BlockRegistry([makeDef(0)]));
    assert.equal(new BlockRegistry().nextId, 1);
  });

  it("does not reuse a gap left between two blocks", () => {
    const registry = new BlockRegistry();
    registry.register(makeDef(1)).register(makeDef(3));

    assert.equal(registry.nextId, 4);
  });

  it("stays put when a block is overwritten with a lower id", () => {
    const registry = new BlockRegistry();
    registry.register(makeDef(7)).register(makeDef(2));

    assert.equal(registry.nextId, 8);
  });

  it("hands out an unused id every time it is registered", () => {
    const registry = new BlockRegistry();
    for (let count = 0; count < 3; count++) {
      const id = registry.nextId;
      assert.equal(registry.has(id), false);
      registry.register(makeDef(id));
    }

    assert.deepEqual(
      [...registry.getAll()].map((def) => def.id),
      [1, 2, 3]
    );
  });
});

describe("BlockRegistry version", () => {
  it("starts at 0 and increments on every register", () => {
    const registry = new BlockRegistry();
    assert.equal(registry.version, 0);

    registry.register({
      id: 1,
      name: "A",
      shapeId: "cube",
      collidable: true,
      faceTextures: {}
    });
    assert.equal(registry.version, 1);

    registry.register({
      id: 2,
      name: "B",
      shapeId: "cube",
      collidable: true,
      faceTextures: {}
    });
    assert.equal(registry.version, 2);
  });

  it("counts definitions registered through the constructor", () => {
    const registry = new BlockRegistry([
      {
        id: 1,
        name: "A",
        shapeId: "cube",
        collidable: true,
        faceTextures: {}
      }
    ]);

    assert.equal(registry.version, 1);
  });
});

describe("BlockRegistry.unregister", () => {
  it("removes the definition and reports the removal", () => {
    const registry = new BlockRegistry([makeBlockDef(3, "cube")]);

    assert.equal(registry.unregister(3), true);
    assert.equal(registry.has(3), false);
  });

  it("reports nothing removed for an unknown id, and leaves version alone", () => {
    const registry = new BlockRegistry([makeBlockDef(3, "cube")]);
    const { version } = registry;

    assert.equal(registry.unregister(99), false);
    assert.equal(registry.version, version);
  });

  it("never recycles the id, so nextId keeps climbing", () => {
    const registry = new BlockRegistry([makeBlockDef(3, "cube")]);

    registry.unregister(3);

    assert.equal(registry.nextId, 4);
  });
});

describe("BlockRegistry.clear", () => {
  it("drops every definition", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "cube")
    ]);

    registry.clear();

    assert.deepEqual([...registry.getAll()], []);
  });

  it("leaves version alone when there is nothing to clear", () => {
    const registry = new BlockRegistry();

    registry.clear();

    assert.equal(registry.version, 0);
  });
});
