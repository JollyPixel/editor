// Import Node.js Dependencies
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TargetPath } from "#src/index.ts";

describe("TargetPath", () => {
  let save: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <jolly-editor-toolbar></jolly-editor-toolbar>
      <jolly-pane key="blocks"><div class="list"><span>Stone</span></div></jolly-pane>
    `;
    const toolbar = document.querySelector("jolly-editor-toolbar")!;
    const shadow = toolbar.attachShadow({ mode: "open" });
    shadow.innerHTML = "<div class=\"group\"><button data-tour=\"save\"></button></div>";
    save = shadow.querySelector("button")!;
  });

  test("runs each selector inside the shadow root of the previous match", () => {
    const path = new TargetPath(["jolly-editor-toolbar", "[data-tour=save]"]);

    assert.equal(path.resolve(document), save);
  });

  test("runs inside the match itself when it has no shadow root", () => {
    const path = new TargetPath(["jolly-pane[key=blocks]", "span"]);

    assert.equal(path.resolve(document)?.textContent, "Stone");
  });

  test("does not reach into a shadow root from the document", () => {
    const path = new TargetPath(["[data-tour=save]"]);

    assert.equal(path.resolve(document), null);
  });

  test("resolves to null when a selector finds nothing", () => {
    const path = new TargetPath(["jolly-editor-toolbar", "[data-tour=missing]"]);

    assert.equal(path.resolve(document), null);
  });
});
