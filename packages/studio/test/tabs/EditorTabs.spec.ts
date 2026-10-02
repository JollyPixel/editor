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

describe("EditorTabs", () => {
  test("opens a tab with its frame and activates it", async() => {
    const { tabs, strip, itemValues, frameOf, visibleFrames } = harness();

    assert.equal(await tabs.open(MAP_TAB), true);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1"]);
    assert.equal(strip.value, "map-1");
    assert.equal(tabs.active, "map-1");
    assert.ok(frameOf("map-1").src.endsWith(MAP_TAB.url));
    assert.equal(frameOf("map-1").title, MAP_TAB.label);
    assert.equal(visibleFrames().length, 1);
  });

  test("focuses an already open tab instead of duplicating it", async() => {
    const { tabs, itemValues, frameOf } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);

    assert.equal(tabs.active, "model-1");
    assert.equal(frameOf("map-1").hidden, true);

    assert.equal(await tabs.open(MAP_TAB), true);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "model-1"]);
    assert.equal(tabs.active, "map-1");
    assert.equal(frameOf("map-1").hidden, false);
    assert.equal(frameOf("model-1").hidden, true);
  });

  test("closes a tab and focuses the most recently activated one", async() => {
    const { tabs, itemValues, frames } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    await tabs.open(OTHER_TAB);
    tabs.focus("model-1");

    assert.equal(tabs.close("model-1"), true);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "map-2"]);
    assert.equal(frames.querySelectorAll("iframe").length, 2);
    assert.equal(tabs.active, "map-2");
    assert.equal(tabs.close("model-1"), false);
  });

  test("closing an inactive tab keeps the active one", async() => {
    const { tabs, strip } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);

    tabs.close("map-1");

    assert.equal(tabs.active, "model-1");
    assert.equal(strip.value, "model-1");
  });

  test("starts on a fixed home tab that is not closable", () => {
    const { tabs, strip, home } = harness();
    const [item] = strip.children;

    assert.equal(tabs.active, HOME_TAB_ID);
    assert.equal(strip.value, HOME_TAB_ID);
    assert.equal(home.hidden, false);
    assert.equal(Reflect.get(item, "fixed"), true);
    assert.notEqual(Reflect.get(item, "closable"), true);
    assert.equal(tabs.close(HOME_TAB_ID), false);
    assert.deepEqual(tabs.ids(), []);
  });

  test("returns to home when the last tab closes", async() => {
    const { tabs, strip, home } = harness();
    await tabs.open(MAP_TAB);
    assert.equal(home.hidden, true);

    tabs.close("map-1");

    assert.equal(tabs.active, HOME_TAB_ID);
    assert.equal(strip.value, HOME_TAB_ID);
    assert.equal(home.hidden, false);
    assert.equal(tabs.size, 0);
  });

  test("focusing home hides every frame and keeps them open", async() => {
    const { tabs, home, visibleFrames } = harness();
    await tabs.open(MAP_TAB);

    assert.equal(tabs.focus(HOME_TAB_ID), true);

    assert.equal(home.hidden, false);
    assert.deepEqual(visibleFrames(), []);
    assert.equal(tabs.size, 1);
  });

  test("moves a tab on the strip's reorder event and keeps home first", async() => {
    const { tabs, strip, itemValues } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    await tabs.open(OTHER_TAB);

    strip.dispatchEvent(new CustomEvent("jolly-tab-reorder", {
      detail: {
        value: "map-2",
        index: 1
      }
    }));
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-2", "map-1", "model-1"]);
    assert.deepEqual(tabs.ids(), ["map-2", "map-1", "model-1"]);

    assert.equal(tabs.move("map-2", 3), true);
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "model-1", "map-2"]);

    assert.equal(tabs.move("map-1", 0), true);
    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "model-1", "map-2"]);
    assert.equal(tabs.move(HOME_TAB_ID, 2), false);
  });

  test("gives an editor tab its icon", async() => {
    const { tabs, strip } = harness();
    await tabs.open({
      ...MAP_TAB,
      icon: "kind:voxelmap"
    });

    assert.equal(Reflect.get(strip.children[1], "icon"), "kind:voxelmap");
  });

  test("gives an editor tab its tooltip", async() => {
    const { tabs, strip } = harness();
    await tabs.open({
      ...MAP_TAB,
      tooltip: "maps/overworld.voxelmap.json"
    });
    await tabs.open(MODEL_TAB);

    assert.equal(
      Reflect.get(strip.children[1], "tooltip"),
      "maps/overworld.voxelmap.json"
    );
    assert.equal(Reflect.get(strip.children[2], "tooltip"), "");
  });

  test("follows the strip's change and close events", async() => {
    const { tabs, strip } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);

    strip.dispatchEvent(new CustomEvent("jolly-tab-change", {
      detail: { value: "map-1" }
    }));
    assert.equal(tabs.active, "map-1");

    strip.dispatchEvent(new CustomEvent("jolly-tab-close", {
      detail: { value: "map-1" }
    }));
    assert.deepEqual(tabs.ids(), ["model-1"]);
  });

  test("relabels an open tab", async() => {
    const { tabs, strip, frameOf } = harness();
    await tabs.open({
      ...MAP_TAB,
      tooltip: "maps/overworld.voxelmap.json"
    });

    assert.equal(tabs.relabel("map-1", {
      label: "renamed",
      tooltip: "maps/renamed.voxelmap.json"
    }), true);
    assert.equal(tabs.relabel("missing", { label: "x" }), false);

    const item = strip.children[1];
    assert.equal(Reflect.get(item, "label"), "renamed");
    assert.equal(Reflect.get(item, "tooltip"), "maps/renamed.voxelmap.json");
    assert.equal(frameOf("map-1").title, "renamed");
    assert.deepEqual(tabs.list(), [
      {
        ...MAP_TAB,
        label: "renamed",
        tooltip: "maps/renamed.voxelmap.json"
      }
    ]);

    tabs.relabel("map-1", { label: "plain" });
    assert.equal(Reflect.get(item, "tooltip"), "");
  });

  test("opens a tab in the background without loading its frame", async() => {
    const { tabs, frames, itemValues, frameOf } = harness();
    await tabs.open(MAP_TAB);

    assert.equal(await tabs.open(MODEL_TAB, { focus: false }), true);

    assert.deepEqual(itemValues(), [HOME_TAB_ID, "map-1", "model-1"]);
    assert.equal(tabs.active, "map-1");
    assert.equal(frames.querySelectorAll("iframe").length, 1);

    tabs.focus("model-1");

    assert.equal(frameOf("model-1").hidden, false);
    assert.equal(frameOf("map-1").hidden, true);
  });

  test("reports each open, focus, move and close", async() => {
    let changes = 0;
    const { tabs } = harness({
      onChange: () => {
        changes++;
      }
    });

    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB, { focus: false });
    tabs.focus(HOME_TAB_ID);
    tabs.move("model-1", 1);
    tabs.close("map-1");
    tabs.relabel("model-1", { label: "renamed" });

    assert.equal(changes, 5);
  });

  test("reloads the active frame and defers an inactive one", async() => {
    const { tabs, frames, frameOf } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    const model = frameOf("model-1");

    assert.equal(tabs.reload("model-1"), true);
    assert.equal(tabs.reload("map-1"), true);
    assert.equal(tabs.reload("missing"), false);

    assert.notEqual(frameOf("model-1"), model);
    assert.equal(frameOf("model-1").hidden, false);
    assert.equal(frames.querySelectorAll("iframe").length, 1);

    tabs.focus("map-1");

    assert.equal(frames.querySelectorAll("iframe").length, 2);
    assert.equal(frameOf("map-1").hidden, false);
  });

  test("dispose removes every tab, reports no change and stops listening", async() => {
    let changes = 0;
    const { tabs, strip, frames } = harness({
      onChange: () => {
        changes++;
      }
    });
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    changes = 0;

    tabs.dispose();
    strip.dispatchEvent(new CustomEvent("jolly-tab-change", {
      detail: { value: HOME_TAB_ID }
    }));

    assert.equal(changes, 0);
    assert.equal(tabs.size, 0);
    assert.equal(strip.children.length, 0);
    assert.equal(frames.children.length, 0);
    assert.equal(tabs.active, HOME_TAB_ID);
  });
});
