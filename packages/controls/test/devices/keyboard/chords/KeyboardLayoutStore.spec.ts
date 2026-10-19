// Import Node.js Dependencies
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { once } from "@openally/emitt";

// Import Internal Dependencies
import {
  KeyboardLayoutStore,
  type KeyboardLayout
} from "../../../../src/index.ts";
import * as mocks from "../../../mocks/index.ts";
import { stubKeyboardLayout } from "../../../helpers/navigator.ts";

async function nextChange(
  store: KeyboardLayoutStore
): Promise<KeyboardLayout | null> {
  const [layout] = await once(store, "change");

  return layout;
}

describe("Controls.KeyboardLayoutStore", () => {
  test("formats chords on QWERTY until a layout is loaded", async(t) => {
    const store = new KeyboardLayoutStore();
    stubKeyboardLayout(t, [["KeyQ", "a"]]);

    assert.equal(store.format("KeyQ"), "Q");
    await store.refresh();
    assert.equal(store.format("KeyQ"), "A");
  });

  test("emits only when the layout changes", async(t) => {
    const store = new KeyboardLayoutStore();
    const layouts: Array<KeyboardLayout | null> = [];
    store.subscribe("change", (layout) => layouts.push(layout));
    stubKeyboardLayout(t, [["KeyQ", "a"]]);

    await store.refresh();
    await store.refresh();
    stubKeyboardLayout(t, [["KeyQ", "q"]]);
    await store.refresh();

    assert.deepEqual(layouts, [
      new Map([["KeyQ", "a"]]),
      new Map([["KeyQ", "q"]])
    ]);
  });

  test("watch() loads now and again on focus until released", async(t) => {
    const store = new KeyboardLayoutStore();
    const target = new mocks.EventTargetAdapter();
    stubKeyboardLayout(t, [["KeyQ", "a"]]);

    const loaded = nextChange(store);
    const release = store.watch(target);
    assert.deepEqual(await loaded, new Map([["KeyQ", "a"]]));

    stubKeyboardLayout(t, [["KeyQ", "q"]]);
    const refocused = nextChange(store);
    target.dispatch("focus", {});
    assert.deepEqual(await refocused, new Map([["KeyQ", "q"]]));

    release();
    const changes: Array<KeyboardLayout | null> = [];
    store.subscribe("change", (layout) => changes.push(layout));
    stubKeyboardLayout(t, [["KeyQ", "a"]]);
    target.dispatch("focus", {});
    await setImmediate();
    assert.deepEqual(changes, []);
  });
});
