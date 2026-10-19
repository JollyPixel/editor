// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  UV_NETS_STORAGE_KEY,
  UvNetLibrary
} from "../../../src/uv/nets/UvNetLibrary.ts";

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

describe("UvNetLibrary", () => {
  test("restores user nets and the default net from storage", () => {
    const storage = new MemoryStorageAdapter();
    const library = new UvNetLibrary({ storage });
    const strip = library.create("Strip", [["front", "back", "left", "right", "top", "bottom"]]);
    const copy = library.duplicate("cross")!;
    library.update(copy.id, { name: "My cross" });
    library.defaultId = strip.id;

    const restored = new UvNetLibrary({ storage });

    assert.deepStrictEqual(ids(restored), ["packed", "cross", strip.id, copy.id]);
    assert.strictEqual(restored.default.name, "Strip");
    assert.deepStrictEqual(restored.get(copy.id)!.rows, library.get("cross")!.rows);
    assert.strictEqual(restored.get(copy.id)!.name, "My cross");
  });

  test("lists host presets after the built-in nets, locked, and starts from the suggested default", () => {
    const library = new UvNetLibrary({
      presets: [kCapsAndSides],
      defaultId: kCapsAndSides.id
    });

    assert.deepStrictEqual(ids(library), ["packed", "cross", kCapsAndSides.id]);
    assert.strictEqual(library.defaultId, kCapsAndSides.id);
    assert.ok(library.get(kCapsAndSides.id)!.locked);
    assert.strictEqual(library.update(kCapsAndSides.id, { name: "Renamed" }), false);
    assert.strictEqual(library.delete("cross"), false);
    assert.strictEqual(new UvNetLibrary({ defaultId: "unknown" }).defaultId, "packed");
  });

  test("falls back to the suggested default when the default net is deleted", () => {
    const library = new UvNetLibrary({
      presets: [kCapsAndSides],
      defaultId: kCapsAndSides.id
    });
    const mine = library.create("Mine");
    library.defaultId = mine.id;

    assert.ok(library.delete(mine.id));

    assert.strictEqual(library.defaultId, kCapsAndSides.id);
    assert.strictEqual(library.get(mine.id), undefined);
  });

  test("refuses a grid without slots and keeps the previous one", () => {
    const library = new UvNetLibrary();
    const mine = library.create("Mine", [["top"]]);
    let changes = 0;
    library.on("change", () => changes++);

    assert.strictEqual(library.update(mine.id, { rows: [[null]] }), false);

    assert.deepStrictEqual(library.get(mine.id)!.rows, [[["top"]]]);
    assert.strictEqual(changes, 0);
  });

  test("drops stored nets that are malformed or no longer valid", () => {
    const storage = new MemoryStorageAdapter();
    storage.set(UV_NETS_STORAGE_KEY, JSON.stringify({
      defaultId: "gone",
      nets: [
        { id: "ok", name: "Ok", rows: [[["top"]]] },
        { id: "twice", name: "Twice", rows: [[["top"], ["top"]]] },
        { id: "shape", name: 4, rows: [] },
        { id: "cross", name: "Shadow", rows: [[["top"]]] }
      ]
    }));

    const library = new UvNetLibrary({ storage });

    assert.deepStrictEqual(ids(library), ["packed", "cross", "ok"]);
    assert.strictEqual(library.get("cross")!.name, "Cross");
    assert.strictEqual(library.defaultId, "packed");
  });
});
