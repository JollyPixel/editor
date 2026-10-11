// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MISSING_BLOCKSET_ID,
  BlocksetList
} from "../../../src/document/blocksets/index.ts";
import { MAX_BLOCKSET_SLOT } from "../../../src/document/blocks/index.ts";

// CONSTANTS
const kAsset = { id: "a1", kind: "blockset" };

describe("BlocksetList", () => {
  it("keeps declaration order and the first id as default", () => {
    const list = new BlocksetList([
      { id: "b", src: "b", tileSize: 16 },
      { id: "a", src: "a", tileSize: 32 },
      { id: "b", src: "dup", tileSize: 8 }
    ]);

    assert.deepEqual([...list].map((def) => def.src), ["b", "a"]);
    assert.equal(list.defaultBlocksetId, "b");
  });

  it("returns copies of its definitions", () => {
    const list = new BlocksetList([{ id: "a", src: "a", tileSize: 16 }]);
    const [definition] = list.definitions();
    definition.tileSize = 99;

    assert.equal(list.get("a")?.tileSize, 16);
  });

  it("rejects duplicates, empty ids and invalid tile sizes", () => {
    const list = new BlocksetList();

    assert.equal(list.add({ id: "", src: "x", tileSize: 16 }), false);
    assert.equal(list.add({ id: "a", src: "x", tileSize: 0 }), false);
    assert.equal(list.add({ id: "a", src: "x", tileSize: 16 }), true);
    assert.equal(list.add({ id: "a", src: "y", tileSize: 16 }), false);
    assert.equal(list.size, 1);
  });

  it("never declares the reserved id", () => {
    const list = new BlocksetList();

    assert.equal(
      list.add({ id: MISSING_BLOCKSET_ID, src: "x", tileSize: 16 }),
      false
    );
    assert.equal(list.size, 0);
  });

  it("declares an asset blockset without a tile size but not a URL one", () => {
    const list = new BlocksetList();

    assert.equal(list.add({ id: "asset", asset: kAsset }), true);
    assert.equal(list.add({ id: "url", src: "url.png" }), false);
    assert.equal(list.get("asset")?.tileSize, undefined);
  });

  it("gives each blockset the lowest free slot", () => {
    const list = new BlocksetList([
      { id: "a", asset: kAsset },
      { id: "b", src: "b", tileSize: 16, slot: 2 },
      { id: "c", asset: kAsset }
    ]);

    assert.deepEqual(
      list.definitions().map(({ id, slot }) => [id, slot]),
      [["a", 0], ["b", 2], ["c", 1]]
    );
    assert.equal(list.findAvailableSlot(), 3);
    assert.equal(list.findBySlot(2)?.id, "b");
    assert.equal(list.findBySlot(3), undefined);
  });

  it("rejects a taken or invalid slot", () => {
    const list = new BlocksetList([{ id: "a", asset: kAsset, slot: 1 }]);

    assert.equal(list.add({ id: "b", asset: kAsset, slot: 1 }), false);
    assert.equal(list.add({ id: "c", asset: kAsset, slot: -1 }), false);
    assert.equal(list.add({ id: "d", asset: kAsset, slot: MAX_BLOCKSET_SLOT + 1 }), false);
    assert.equal(list.add({ id: "e", asset: kAsset, slot: 1.5 }), false);
    assert.equal(list.size, 1);
  });

  it("reuses the slot of a removed blockset", () => {
    const list = new BlocksetList([
      { id: "a", asset: kAsset },
      { id: "b", asset: kAsset }
    ]);
    list.remove("a");

    assert.equal(list.findAvailableSlot(), 0);
    list.add({ id: "c", asset: kAsset });
    assert.equal(list.get("c")?.slot, 0);
  });

  it("skips reserved slots when looking for a free one", () => {
    const list = new BlocksetList([{ id: "a", asset: kAsset }]);

    assert.equal(list.findAvailableSlot([1, 2]), 3);
  });

  it("keeps explicit slots on replace when a slotless blockset comes first", () => {
    const list = new BlocksetList([
      { id: "a", asset: kAsset },
      { id: "b", asset: kAsset, slot: 0 }
    ]);

    assert.deepEqual(
      [...list].map(({ id, slot }) => [id, slot]),
      [["a", 1], ["b", 0]]
    );
  });

  it("declares a tile size onto an asset blockset while keeping its slot", () => {
    const list = new BlocksetList([
      { id: "a", asset: kAsset, slot: 4 }
    ]);

    assert.equal(list.declare({ id: "a", asset: kAsset, tileSize: 32, slot: 7 }), true);
    assert.deepEqual(list.get("a"), {
      id: "a",
      asset: kAsset,
      tileSize: 32,
      slot: 4
    });
  });

  it("adds an undeclared blockset on declare and rejects an invalid one", () => {
    const list = new BlocksetList();

    assert.equal(list.declare({ id: "a", src: "a", tileSize: 16 }), true);
    assert.equal(list.declare({ id: "a", src: "a", tileSize: 0 }), false);
    assert.equal(list.get("a")?.tileSize, 16);
  });

  it("copies the asset reference it stores", () => {
    const asset = { id: "a1", kind: "blockset" };
    const list = new BlocksetList([{ id: "a", asset, tileSize: 16 }]);
    asset.id = "mutated";

    assert.deepEqual(list.get("a")?.asset, { id: "a1", kind: "blockset" });
  });

  it("skips undeclarable definitions on replace", () => {
    const list = new BlocksetList([
      { id: "", src: "empty", tileSize: 16 },
      { id: "zero", src: "zero", tileSize: 0 },
      { id: "a", src: "a", tileSize: 16 }
    ]);

    assert.deepEqual([...list].map(({ id }) => id), ["a"]);
  });

  it("bumps its version on every change", () => {
    const list = new BlocksetList();
    const before = list.version;
    list.add({ id: "a", src: "a", tileSize: 16 });
    list.remove("a");

    assert.equal(list.version, before + 2);
    assert.equal(list.remove("a"), false);
    assert.equal(list.version, before + 2);
  });
});
