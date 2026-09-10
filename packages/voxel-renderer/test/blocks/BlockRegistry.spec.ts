// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  BlockRegistry
} from "../../src/blocks/index.ts";
import { FACE } from "../../src/utils/math.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

/** A definition whose only distinguishing feature is its id and name. */
function makeDef(
  id: number,
  name = `Block${id}`
): BlockDefinition {
  return makeBlockDef(id, "cube", {
    name,
    defaultTexture: { col: 0, row: 0, tilesetId: "atlas" }
  });
}

describe("BlockRegistry — air is reserved", () => {
  it("refuses id 0 wherever a definition enters", () => {
    for (const register of [
      () => new BlockRegistry([makeDef(1), makeDef(0)]),
      () => new BlockRegistry().register(makeDef(0)),
      () => new BlockRegistry().registerMany([makeDef(0)])
    ]) {
      assert.throws(register, /Block id 0 is reserved/);
    }
  });

  it("leaves a registry that rejected a definition untouched", () => {
    assert.throws(() => new BlockRegistry([makeDef(0)]));

    const registry = new BlockRegistry();
    assert.equal(registry.nextId, 1);
    assert.equal(registry.version, 0);
  });
});

describe("BlockRegistry — last registration wins", () => {
  it("overwrites a definition sharing an id", () => {
    const registry = new BlockRegistry([makeDef(1, "first")]);

    registry.register(makeDef(1, "second"));
    registry.registerMany([makeDef(1, "third")]);

    assert.equal(registry.get(1)?.name, "third");
    assert.equal([...registry].length, 1);
  });

  it("keeps the incumbent when skipExisting is set", () => {
    const registry = new BlockRegistry([makeDef(1, "first")]);

    registry.registerMany(
      [makeDef(1, "second"), makeDef(2, "new")],
      { skipExisting: true }
    );

    assert.equal(registry.get(1)?.name, "first");
    assert.equal(registry.get(2)?.name, "new");
  });

  it("takes definitions from any iterable, not just an array", () => {
    const registry = new BlockRegistry();

    registry.registerMany(new Set([makeDef(1), makeDef(2)]));

    assert.deepEqual(
      [...registry].map((definition) => definition.id),
      [1, 2]
    );
  });
});

describe("BlockRegistry — registration resolves the authored definition", () => {
  it("fills in the omitted parts of a bare definition", () => {
    const registry = new BlockRegistry();

    registry.register({ id: 1, name: "A", shapeId: "cube" });

    assert.deepEqual(registry.get(1), {
      id: 1,
      name: "A",
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      properties: {}
    });
  });

  it("keeps an explicit collidable of false", () => {
    const registry = new BlockRegistry();

    registry.register({ id: 1, name: "A", shapeId: "cube", collidable: false });

    assert.equal(registry.get(1)!.collidable, false);
  });

  it("expands every tile ref tuple against defaultTilesetId", () => {
    const registry = new BlockRegistry();

    registry.register({
      id: 5,
      name: "A",
      shapeId: "cube",
      defaultTilesetId: "terrain",
      defaultTexture: [5, 6],
      faceTextures: {
        [FACE.NegY]: [1, 2],
        [FACE.PosY]: { col: 5, row: 6 }
      }
    });

    assert.deepEqual(registry.get(5)!.defaultTexture, {
      col: 5,
      row: 6,
      tilesetId: "terrain"
    });
    assert.deepEqual(
      registry.get(5)!.faceTextures,
      {
        bottom: { col: 1, row: 2, tilesetId: "terrain" },
        top: { col: 5, row: 6, tilesetId: "terrain" }
      },
      "a numeric FACE key resolves to that face's default slot"
    );
  });

  it("resolves into a copy, leaving the authored definition alone", () => {
    const registry = new BlockRegistry();
    const authored: BlockDefinition = {
      id: 1,
      name: "A",
      shapeId: "cube",
      faceTextures: { [FACE.PosY]: [1, 2] },
      defaultTexture: { col: 0, row: 0 },
      defaultTilesetId: "atlas"
    };

    registry.register(authored);

    assert.deepEqual(authored.faceTextures, { [FACE.PosY]: [1, 2] });
    assert.deepEqual(authored.defaultTexture, { col: 0, row: 0 });
  });
});

describe("BlockRegistry — lookup", () => {
  it("finds a registered definition and reports an unknown one as absent", () => {
    const registry = new BlockRegistry([makeDef(5)]);

    assert.deepEqual(registry.get(5), makeDef(5));
    assert.equal(registry.has(5), true);

    assert.equal(registry.get(99), undefined);
    assert.equal(registry.has(99), false);
  });

  it("enumerates the same definitions through getAll and iteration", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);

    assert.deepEqual([...registry], [...registry.getAll()]);
    assert.deepEqual(
      [...registry].map((definition) => definition.id),
      [1, 2, 3]
    );
  });

  it("enumerates nothing while empty", () => {
    assert.deepEqual([...new BlockRegistry().getAll()], []);
  });
});

describe("BlockRegistry — nextId never collides", () => {
  it("starts at one, so it can never hand out air", () => {
    assert.equal(new BlockRegistry().nextId, 1);
  });

  it("sits above the highest id, whatever order they arrived in", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(3)]);
    registry.register(makeDef(9)).register(makeDef(2));

    assert.equal(registry.nextId, 10);
  });

  it("never recycles an id, not across a gap nor after a removal", () => {
    const registry = new BlockRegistry([makeDef(3)]);

    registry.unregister(3);

    assert.equal(registry.nextId, 4);
  });

  it("stays free every time it is consumed", () => {
    const registry = new BlockRegistry();

    for (let count = 0; count < 3; count++) {
      const id = registry.nextId;
      assert.equal(registry.has(id), false);
      registry.register(makeDef(id));
    }

    assert.deepEqual([...registry].map((definition) => definition.id), [1, 2, 3]);
  });
});

describe("BlockRegistry — version tracks real changes", () => {
  it("counts every definition that enters, constructor included", () => {
    const registry = new BlockRegistry([makeDef(1)]);
    assert.equal(registry.version, 1);

    registry.register(makeDef(2));
    assert.equal(registry.version, 2);
  });

  it("stands still for a skipped definition", () => {
    const registry = new BlockRegistry([makeDef(1)]);
    const { version } = registry;

    registry.registerMany([makeDef(1)], { skipExisting: true });

    assert.equal(registry.version, version);
  });

  it("stands still for an unregister that removed nothing", () => {
    const registry = new BlockRegistry([makeDef(3)]);
    const { version } = registry;

    assert.equal(registry.unregister(99), false);
    assert.equal(registry.version, version);
  });

  it("stands still for a clear with nothing to drop", () => {
    const registry = new BlockRegistry();

    registry.clear();

    assert.equal(registry.version, 0);
  });
});

describe("BlockRegistry — removal", () => {
  it("drops one definition and reports the removal", () => {
    const registry = new BlockRegistry([makeDef(3)]);

    assert.equal(registry.unregister(3), true);
    assert.equal(registry.has(3), false);
  });

  it("drops every definition on clear", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2)]);

    registry.clear();

    assert.deepEqual([...registry.getAll()], []);
  });
});

describe("BlockRegistry — custom properties", () => {
  it("defaults to an empty map", () => {
    const registry = new BlockRegistry([makeDef(1)]);

    assert.deepEqual(registry.get(1)?.properties, {});
    assert.deepEqual(registry.propertiesOf(1), {});
  });

  it("keeps every scalar value", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube", {
        properties: {
          hardness: 5,
          material: "stone",
          flammable: false
        }
      })
    ]);

    assert.deepEqual(registry.propertiesOf(1), {
      hardness: 5,
      material: "stone",
      flammable: false
    });
  });

  it("drops values that are not a finite scalar", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube", {
        properties: {
          kept: 1,
          nested: { deep: true },
          list: [1, 2],
          nothing: null,
          missing: undefined,
          notANumber: NaN,
          endless: Infinity
        } as never
      })
    ]);

    assert.deepEqual(registry.propertiesOf(1), { kept: 1 });
  });

  it("ignores a __proto__ key instead of polluting the prototype", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube", {
        properties: JSON.parse(
          '{ "__proto__": { "polluted": true }, "safe": 1 }'
        )
      })
    ]);

    const properties = registry.propertiesOf(1);

    assert.deepEqual(properties, { safe: 1 });
    assert.equal(
      ({} as Record<string, unknown>).polluted,
      undefined
    );
    assert.equal(Object.getPrototypeOf(properties), Object.prototype);
  });

  it("hands out a copy that callers may mutate freely", () => {
    const source = { hardness: 5 };
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube", { properties: source })
    ]);

    const first = registry.propertiesOf(1)!;
    first.hardness = 99;
    source.hardness = 42;

    assert.deepEqual(registry.propertiesOf(1), { hardness: 5 });
    assert.notEqual(first, registry.propertiesOf(1));
  });

  it("returns undefined for an unregistered id", () => {
    const registry = new BlockRegistry([makeDef(1)]);

    assert.equal(registry.propertiesOf(404), undefined);
    assert.equal(registry.propertiesOf(0), undefined);
  });
});

describe("resolveBlockDefinition — properties are idempotent", () => {
  it("survives a second resolution unchanged", () => {
    const once = resolveBlockDefinition(
      makeBlockDef(1, "cube", { properties: { hardness: 5 } })
    );
    const twice = resolveBlockDefinition(once);

    assert.deepEqual(twice.properties, { hardness: 5 });
    assert.notEqual(twice.properties, once.properties);
  });
});
