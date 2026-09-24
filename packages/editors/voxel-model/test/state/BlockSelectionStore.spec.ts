// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockSelectionStore } from "#src/state/index.ts";

describe("BlockSelectionStore select", () => {
  test("updates the selected id and emits it", () => {
    const store = new BlockSelectionStore();
    const selections: (string | null)[] = [];
    store.on("select", (uuid) => selections.push(uuid));

    store.select("a");
    store.select("b");

    assert.equal(store.selected, "b");
    assert.deepEqual(selections, ["a", "b"]);
  });

  test("emits even when the selection is unchanged", () => {
    const store = new BlockSelectionStore();
    let emitted = 0;
    store.on("select", () => emitted++);

    store.select("a");
    store.select("a");

    assert.equal(emitted, 2);
  });
});

describe("BlockSelectionStore hover", () => {
  test("updates the hovered id and emits it", () => {
    const store = new BlockSelectionStore();
    const hovers: (string | null)[] = [];
    store.on("hover", (uuid) => hovers.push(uuid));

    store.hover("a");
    store.hover("b");
    store.hover(null);

    assert.equal(store.hovered, null);
    assert.deepEqual(hovers, ["a", "b", null]);
  });

  test("hovering the same id again does not re-emit", () => {
    const store = new BlockSelectionStore();
    let emitted = 0;
    store.on("hover", () => emitted++);

    store.hover("a");
    store.hover("a");

    assert.equal(emitted, 1);
  });
});

describe("BlockSelectionStore forget", () => {
  test("clears only the marks that point at the forgotten id", () => {
    const store = new BlockSelectionStore();
    store.select("a");
    store.hover("b");

    store.forget("a");

    assert.equal(store.selected, null);
    assert.equal(store.hovered, "b");
  });
});
