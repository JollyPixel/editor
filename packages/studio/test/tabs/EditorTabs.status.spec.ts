// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  disposeHarness,
  harness,
  MAP_TAB,
  MODEL_TAB
} from "../helpers/editorTabs.ts";

afterEach(disposeHarness);

describe("EditorTabs status", () => {
  test("a tab is busy from its frame creation until its editor is ready", async() => {
    const { tabs, statusOf } = harness();
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB, { focus: false });

    assert.equal(statusOf("map-1"), "busy");
    assert.equal(statusOf("model-1"), "idle");

    tabs.markState("map-1", "ready");
    tabs.focus("model-1");
    tabs.focus("map-1");

    assert.equal(statusOf("map-1"), "idle");
    assert.equal(statusOf("model-1"), "busy");

    tabs.markState("model-1", "failed");
    assert.equal(statusOf("model-1"), "failed");

    tabs.reload("model-1");
    assert.equal(statusOf("model-1"), "idle");
    tabs.reload("map-1");
    assert.equal(statusOf("map-1"), "busy");
  });
});
