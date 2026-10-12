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
  PAGE_ID
} from "../helpers/editorTabs.ts";

afterEach(disposeHarness);

describe("EditorTabs pages", () => {
  test("opens a shell page once, behind a closable tab that hides home and frames", async() => {
    const { tabs, strip, home, page, itemValues, visibleFrames } = harness();
    await tabs.open(MAP_TAB);

    assert.equal(tabs.openPage(PAGE_ID), true);
    tabs.focus("map-1");
    assert.equal(tabs.openPage(PAGE_ID), true);

    const item = strip.lastElementChild;
    assert.ok(item);
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", PAGE_ID]);
    assert.equal(Reflect.get(item, "closable"), true);
    assert.equal(tabs.active, PAGE_ID);
    assert.equal(page.hidden, false);
    assert.equal(home.hidden, true);
    assert.deepEqual(visibleFrames(), []);
    assert.deepEqual(tabs.ids(), ["map-1"]);
    assert.equal(tabs.openPage("unknown"), false);
  });

  test("closing the active shell page returns to the last editor tab", async() => {
    const { tabs, page, itemValues } = harness();
    await tabs.open(MAP_TAB);
    tabs.openPage(PAGE_ID);

    assert.equal(tabs.close(PAGE_ID), true);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1"]);
    assert.equal(tabs.active, "map-1");
    assert.equal(page.hidden, true);
    assert.equal(tabs.focus(PAGE_ID), false);
    assert.equal(tabs.close(PAGE_ID), false);
  });
});
