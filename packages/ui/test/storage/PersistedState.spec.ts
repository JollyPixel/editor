// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { PersistedState } from "../../src/storage/PersistedState.ts";
import { MemoryStorageAdapter } from "../../src/storage/MemoryStorageAdapter.ts";

test("PersistedState reads and writes local state when unmanaged", () => {
  const storage = new MemoryStorageAdapter();
  const state = new PersistedState(host(), {
    isManaged: () => false,
    namespace: () => "pane",
    storage: () => storage,
    onManagedWrite: () => assert.fail("unexpected managed write")
  });

  state.write("collapsed", "true");

  assert.equal(storage.get("pane:collapsed"), "true");
  assert.equal(state.read("collapsed"), "true");
});

test("PersistedState delegates managed writes to the owning layout", () => {
  const storage = new MemoryStorageAdapter();
  let dirty = 0;
  const state = new PersistedState(host(), {
    isManaged: () => true,
    namespace: () => "pane",
    storage: () => storage,
    onManagedWrite: () => {
      dirty++;
    }
  });

  state.write("collapsed", "true");

  assert.equal(dirty, 1);
  assert.equal(storage.get("pane:collapsed"), null);
  assert.equal(state.read("collapsed"), null);
});

function host(): ReactiveControllerHost {
  return {
    addController(
      controller: ReactiveController
    ) {
      controller.hostConnected?.();
    },
    removeController() {
      return;
    },
    requestUpdate() {
      return;
    },
    updateComplete: Promise.resolve(true)
  };
}
