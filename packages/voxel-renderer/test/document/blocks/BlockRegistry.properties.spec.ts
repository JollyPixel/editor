// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  BlockRegistry
} from "../../../src/document/blocks/index.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

function makeDef(
  id: number,
  name = `Block${id}`
): BlockDefinition {
  return makeBlockDef(id, "cube", {
    name,
    defaultTexture: { col: 0, row: 0, blocksetId: "atlas" }
  });
}

describe("BlockRegistry — custom properties", () => {
  it("defaults to an empty map", () => {
    const registry = new BlockRegistry([makeDef(1)]);

    assert.deepEqual(registry.get(1)?.properties, {});
    assert.deepEqual(registry.copyProperties(1), {});
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

    assert.deepEqual(registry.copyProperties(1), {
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

    assert.deepEqual(registry.copyProperties(1), { kept: 1 });
  });

  it("ignores a __proto__ key instead of polluting the prototype", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube", {
        properties: JSON.parse(
          '{ "__proto__": { "polluted": true }, "safe": 1 }'
        )
      })
    ]);

    const properties = registry.copyProperties(1);

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

    const first = registry.copyProperties(1)!;
    first.hardness = 99;
    source.hardness = 42;

    assert.deepEqual(registry.copyProperties(1), { hardness: 5 });
    assert.notEqual(first, registry.copyProperties(1));
  });

  it("returns undefined for an unregistered id", () => {
    const registry = new BlockRegistry([makeDef(1)]);

    assert.equal(registry.copyProperties(404), undefined);
    assert.equal(registry.copyProperties(0), undefined);
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

describe("BlockRegistry — ordering", () => {
  function ids(
    registry: BlockRegistry
  ): number[] {
    return [...registry].map((block) => block.id);
  }

  it("iterates in registration order, not id order", () => {
    const registry = new BlockRegistry([
      makeDef(3),
      makeDef(1),
      makeDef(2)
    ]);

    assert.deepEqual(ids(registry), [3, 1, 2]);
  });

  it("keeps the slot of a re-registered definition", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);

    registry.register(makeDef(1, "edited"));

    assert.deepEqual(ids(registry), [1, 2, 3]);
    assert.equal(registry.get(1)?.name, "edited");
  });

  it("moves a block forward", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);

    assert.equal(registry.moveBlockToIndex(1, 2), true);

    assert.deepEqual(ids(registry), [2, 3, 1]);
  });

  it("moves a block backward", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);

    assert.equal(registry.moveBlockToIndex(3, 0), true);

    assert.deepEqual(ids(registry), [3, 1, 2]);
  });

  it("clamps an out-of-range index", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2), makeDef(3)]);

    assert.equal(registry.moveBlockToIndex(1, 99), true);
    assert.deepEqual(ids(registry), [2, 3, 1]);

    assert.equal(registry.moveBlockToIndex(1, -5), true);
    assert.deepEqual(ids(registry), [1, 2, 3]);
  });

  it("bumps the version only when the order changes", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2)]);
    const version = registry.version;

    assert.equal(registry.moveBlockToIndex(1, 0), false);
    assert.equal(registry.version, version);

    assert.equal(registry.moveBlockToIndex(1, 1), true);
    assert.equal(registry.version, version + 1);
  });

  it("ignores an unknown id", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(2)]);

    assert.equal(registry.moveBlockToIndex(404, 0), false);
    assert.deepEqual(ids(registry), [1, 2]);
  });

  it("reports the index of a block", () => {
    const registry = new BlockRegistry([makeDef(5), makeDef(7)]);

    assert.equal(registry.findIndex(5), 0);
    assert.equal(registry.findIndex(7), 1);
    assert.equal(registry.findIndex(404), -1);
    assert.equal(registry.size, 2);
  });

  it("leaves nextId untouched by a move", () => {
    const registry = new BlockRegistry([makeDef(1), makeDef(9)]);

    registry.moveBlockToIndex(9, 0);

    assert.equal(registry.nextId, 10);
  });
});
