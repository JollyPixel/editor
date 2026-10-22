// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  disposeHarness,
  harness,
  MAP_TAB,
  MODEL_TAB
} from "../helpers/editorTabs.ts";

afterEach(disposeHarness);

describe("EditorTabs unsaved", () => {
  test("asks before the strip closes a tab marked unsaved", async() => {
    const answers = [false, true];
    const asked: string[] = [];
    const { tabs, strip } = harness({
      confirmClose: (tab) => {
        asked.push(tab.id);

        return Promise.resolve(answers.shift() ?? true);
      }
    });
    await tabs.open(MAP_TAB);
    await tabs.open(MODEL_TAB);
    tabs.markUnsaved("map-1", true);
    function requestClose(id: string): Promise<void> {
      strip.dispatchEvent(new CustomEvent("jolly-tab-close", {
        detail: { value: id }
      }));

      return setImmediate();
    }

    await requestClose("map-1");
    assert.deepEqual(tabs.ids(), ["map-1", "model-1"]);

    await requestClose("map-1");
    await requestClose("model-1");
    assert.deepEqual(tabs.ids(), []);
    assert.deepEqual(asked, ["map-1", "map-1"]);
  });
});
