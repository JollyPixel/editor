// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { HOME_TAB_ID } from "../../src/tabs/EditorTabs.ts";
import {
  disposeHarness,
  harness,
  MAP_TAB,
  MODEL_TAB,
  OTHER_TAB
} from "../helpers/editorTabs.ts";

afterEach(disposeHarness);

describe("EditorTabs cap", () => {
  test("home does not count toward the cap", async() => {
    const { tabs } = harness({ cap: 1 });

    assert.equal(await tabs.open(MAP_TAB), true);
    assert.deepEqual(tabs.ids(), ["map-1"]);
  });

  test("evicts the least recently activated tab at the cap", async() => {
    const asked: string[] = [];
    const { tabs, itemValues } = harness({
      cap: 2,
      confirmEvict: (tab) => {
        asked.push(tab.id);

        return true;
      }
    });
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    tabs.focus("map-1");

    assert.equal(await tabs.open(OTHER_TAB), true);

    assert.deepEqual(asked, ["model-1"]);
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "map-2"]);
    assert.equal(tabs.active, "map-2");
  });

  test("leaves the request unopened when eviction is declined", async() => {
    const { tabs, itemValues } = harness({
      cap: 2,
      confirmEvict: () => Promise.resolve(false)
    });
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);

    assert.equal(await tabs.open(OTHER_TAB), false);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "model-1"]);
    assert.equal(tabs.active, "model-1");
  });

  test("concurrent opens during an eviction stay within the cap", async() => {
    const pending: Array<(confirmed: boolean) => void> = [];
    const { tabs, itemValues } = harness({
      cap: 1,
      confirmEvict: () => {
        const { promise, resolve } = Promise.withResolvers<boolean>();
        pending.push(resolve);

        return promise;
      }
    });
    await tabs.open(MAP_TAB);

    const first = tabs.open(MODEL_TAB);
    const second = tabs.open(MODEL_TAB);
    for (const resolve of pending) {
      resolve(true);
    }

    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "model-1"]);
    assert.equal(tabs.size, 1);
  });
});
