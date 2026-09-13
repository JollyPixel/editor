// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NamespacedStore } from "../../src/storage/NamespacedStore.ts";
import { MemoryStorageAdapter } from "../../src/storage/MemoryStorageAdapter.ts";

function store(
  storage = new MemoryStorageAdapter(),
  namespace = "pane"
): NamespacedStore {
  return new NamespacedStore({
    namespace: () => namespace,
    storage: () => storage
  });
}

describe("Storage.NamespacedStore", () => {
  test("reads and writes strings under the namespace", () => {
    const storage = new MemoryStorageAdapter();
    const state = store(storage);

    state.write("label", "open");

    assert.equal(storage.get("pane:label"), "open");
    assert.equal(state.read("label"), "open");
  });

  test("round-trips booleans and rejects other text", () => {
    const storage = new MemoryStorageAdapter();
    const state = store(storage);

    state.writeBoolean("collapsed", true);
    storage.set("pane:broken", "yes");

    assert.equal(state.readBoolean("collapsed"), true);
    assert.equal(state.readBoolean("broken"), null);
    assert.equal(state.readBoolean("missing"), null);
  });

  test("round-trips finite numbers and rejects blank or non-finite text", () => {
    const storage = new MemoryStorageAdapter();
    const state = store(storage);

    state.writeNumber("size", 240.5);
    storage.set("pane:blank", " ");
    storage.set("pane:nan", "wide");

    assert.equal(state.readNumber("size"), 240.5);
    assert.equal(state.readNumber("blank"), null);
    assert.equal(state.readNumber("nan"), null);
  });

  test("round-trips JSON and returns null for malformed text", () => {
    const storage = new MemoryStorageAdapter();
    const state = store(storage);

    state.writeJson("order", ["a", "b"]);
    storage.set("pane:bad", "{ nope");

    assert.deepEqual(state.readJson("order"), ["a", "b"]);
    assert.equal(state.readJson("bad"), null);
  });

  test("an empty namespace disables persistence", () => {
    const storage = new MemoryStorageAdapter();
    const state = store(storage, "");

    state.write("theme", "dark");

    assert.equal(storage.get(":theme"), null);
    assert.equal(state.read("theme"), null);
  });

  test("delegates managed writes to the owning layout", () => {
    const storage = new MemoryStorageAdapter();
    let dirty = 0;
    const state = new NamespacedStore({
      isManaged: () => true,
      namespace: () => "pane",
      storage: () => storage,
      onManagedWrite: () => {
        dirty++;
      }
    });

    state.writeBoolean("collapsed", true);

    assert.equal(dirty, 1);
    assert.equal(storage.get("pane:collapsed"), null);
    assert.equal(state.readBoolean("collapsed"), null);
  });
});
