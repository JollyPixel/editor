// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PageState } from "#src/boot/PageState.ts";
import {
  editorState,
  resetStandalonePage
} from "../helpers/standalone.ts";

function loadingBar(): "hidden" | "shown" | "blocking" {
  const bar = document.querySelector("jolly-editor-loading-bar");
  if (bar === null || bar.hidden) {
    return "hidden";
  }

  return bar.blocking ? "blocking" : "shown";
}

describe("PageState", () => {
  afterEach(resetStandalonePage);

  test("shows the loading bar while the editor boots and blocks input while it switches", () => {
    const page = new PageState();
    const bars = (["booting", "ready", "switching", "failed"] as const)
      .map((state) => {
        page.show(state);
        assert.equal(editorState(), state);

        return loadingBar();
      });

    assert.deepEqual(bars, ["shown", "hidden", "blocking", "hidden"]);
  });

  test("removes the loading bar once disposed", () => {
    const page = new PageState();
    page.show("booting");
    page.dispose();

    assert.equal(document.querySelector("jolly-editor-loading-bar"), null);
  });
});
