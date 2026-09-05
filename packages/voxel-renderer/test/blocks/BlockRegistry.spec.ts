// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type BlockDefinition, BlockRegistry } from "../../src/blocks/index.ts";
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
      faceTextures: {}
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
    assert.deepEqual(registry.get(5)!.faceTextures, {
      [FACE.NegY]: { col: 1, row: 2, tilesetId: "terrain" },
      [FACE.PosY]: { col: 5, row: 6, tilesetId: "terrain" }
    });
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
