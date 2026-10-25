// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UvNetLibrary } from "../../../src/uv/nets/UvNetLibrary.ts";
import { UvNetTestDocument } from "../../fixtures/uvNetDocument.ts";

// CONSTANTS
const kCapsAndSides = {
  id: "host:caps-sides",
  name: "Top/bottom + sides",
  rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
};

function ids(
  library: UvNetLibrary
): string[] {
  return [...library].map((preset) => preset.id);
}

function openLibrary(
  document = new UvNetTestDocument()
): UvNetLibrary {
  const library = new UvNetLibrary({
    presets: [kCapsAndSides],
    defaultId: kCapsAndSides.id
  });
  library.document = document;

  return library;
}

describe("UvNetLibrary", () => {
  test("saves nets and the default net in the open texture and follows a texture switch", () => {
    const first = new UvNetTestDocument();
    const library = openLibrary(first);
    const strip = library.create("Strip", [["front", "back", "left", "right", "top", "bottom"]])!;
    const copy = library.duplicate("cross")!;
    library.update(copy.id, { name: "My cross" });
    library.changeDefault(strip.id);

    library.document = new UvNetTestDocument();
    assert.deepStrictEqual(ids(library), ["packed", "cross", kCapsAndSides.id]);
    assert.strictEqual(library.defaultId, kCapsAndSides.id);

    library.document = first;
    assert.deepStrictEqual(ids(library), ["packed", "cross", kCapsAndSides.id, strip.id, copy.id]);
    assert.strictEqual(library.default.name, "Strip");
    assert.deepStrictEqual(library.get(copy.id)!.rows, library.get("cross")!.rows);
    assert.strictEqual(first.uvNets.get(copy.id)!.name, "My cross");
  });

  test("lists host presets after the built-in nets, locked, and starts from the suggested default", () => {
    const library = openLibrary();

    assert.strictEqual(library.defaultId, kCapsAndSides.id);
    assert.ok(library.get(kCapsAndSides.id)!.locked);
    assert.strictEqual(library.update(kCapsAndSides.id, { name: "Renamed" }), false);
    assert.strictEqual(library.delete("cross"), false);
    assert.strictEqual(new UvNetLibrary({ defaultId: "unknown" }).defaultId, "packed");
  });

  test("falls back to the suggested default while the default net is deleted", () => {
    const document = new UvNetTestDocument();
    const library = openLibrary(document);
    const mine = library.create("Mine")!;
    library.changeDefault(mine.id);

    assert.ok(library.delete(mine.id));
    assert.strictEqual(library.defaultId, kCapsAndSides.id);
    assert.strictEqual(library.get(mine.id), undefined);

    document.saveUvNet({ id: mine.id, name: "Mine", rows: [[["top"]]] });
    assert.strictEqual(library.defaultId, mine.id);
  });

  test("lists nets a peer saves in the open texture, except those reusing a locked id", () => {
    const document = new UvNetTestDocument();
    const library = openLibrary(document);
    let changes = 0;
    library.on("change", () => changes++);

    document.saveUvNet({ id: "peer", name: "Peer", rows: [[["top"]]] });
    document.saveUvNet({ id: "cross", name: "Shadow", rows: [[["top"]]] });

    assert.deepStrictEqual(ids(library), ["packed", "cross", kCapsAndSides.id, "peer"]);
    assert.strictEqual(library.get("cross")!.name, "Cross");
    assert.strictEqual(changes, 2);
  });

  test("refuses a grid without slots and keeps the previous one", () => {
    const library = openLibrary();
    const mine = library.create("Mine", [["top"]])!;
    let changes = 0;
    library.on("change", () => changes++);

    assert.strictEqual(library.update(mine.id, { rows: [[null]] }), false);

    assert.deepStrictEqual(library.get(mine.id)!.rows, [[["top"]]]);
    assert.strictEqual(changes, 0);
  });

  test("offers only locked nets and changes nothing while no texture is open", () => {
    const library = new UvNetLibrary();

    assert.strictEqual(library.changeDefault("cross"), false);
    assert.strictEqual(library.create("Mine"), null);
    assert.strictEqual(library.duplicate("cross"), null);
    assert.strictEqual(library.defaultId, "packed");
  });
});
