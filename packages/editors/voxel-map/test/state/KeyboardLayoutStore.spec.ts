// Import Node.js Dependencies
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { KeyboardLayout } from "@jolly-pixel/controls";
import { once } from "@openally/emitt";

// Import Internal Dependencies
import { KeyboardLayoutStore } from "../../src/state/KeyboardLayoutStore.ts";

// CONSTANTS
const kNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);

function useLayout(
  entries: Array<[string, string]>
): void {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      keyboard: {
        getLayoutMap: async() => new Map(entries)
      }
    },
    configurable: true
  });
}

async function nextChange(
  store: KeyboardLayoutStore
): Promise<KeyboardLayout | null> {
  const [layout] = await once(store, "change");

  return layout;
}

describe("KeyboardLayoutStore", () => {
  afterEach(() => {
    if (kNavigatorDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    else {
      Object.defineProperty(globalThis, "navigator", kNavigatorDescriptor);
    }
  });

  test("formats chords on QWERTY until a layout is loaded", async() => {
    const store = new KeyboardLayoutStore();
    useLayout([["KeyQ", "a"]]);

    assert.equal(store.format("KeyQ"), "Q");
    await store.refresh();
    assert.equal(store.format("KeyQ"), "A");
    assert.equal(store.format("Mod+z").endsWith("Z"), true);
  });

  test("emits only when the layout changes", async() => {
    const store = new KeyboardLayoutStore();
    const layouts: Array<KeyboardLayout | null> = [];
    store.subscribe("change", (layout) => layouts.push(layout));
    useLayout([["KeyQ", "a"]]);

    await store.refresh();
    await store.refresh();
    useLayout([["KeyQ", "q"]]);
    await store.refresh();

    assert.deepEqual(layouts, [
      new Map([["KeyQ", "a"]]),
      new Map([["KeyQ", "q"]])
    ]);
  });

  test("watch() loads now and again on focus until released", async() => {
    const store = new KeyboardLayoutStore();
    const target = document.createElement("div");
    useLayout([["KeyQ", "a"]]);

    const loaded = nextChange(store);
    const release = store.watch(target);
    assert.deepEqual(await loaded, new Map([["KeyQ", "a"]]));

    useLayout([["KeyQ", "q"]]);
    const refocused = nextChange(store);
    target.dispatchEvent(new window.Event("focus"));
    assert.deepEqual(await refocused, new Map([["KeyQ", "q"]]));

    release();
    const changes: Array<KeyboardLayout | null> = [];
    store.subscribe("change", (layout) => changes.push(layout));
    useLayout([["KeyQ", "a"]]);
    target.dispatchEvent(new window.Event("focus"));
    await setImmediate();
    assert.deepEqual(changes, []);
  });
});
