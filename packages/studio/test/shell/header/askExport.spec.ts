// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { exportChoice } from "../../../src/shell/header/askExport.ts";

describe("exportChoice", () => {
  test("offers and focuses only the project without a default scene", () => {
    const choice = exportChoice(null);

    assert.deepEqual(
      choice.actions.map((action) => action.value),
      ["project"]
    );
    assert.equal(choice.focus, "project");
  });

  test("offers the game too and focuses it once a default scene is set", () => {
    const choice = exportChoice({
      id: "scene-1",
      kind: "scene",
      path: "scenes/main.scene.json"
    });

    assert.deepEqual(
      choice.actions.map((action) => action.value),
      ["project", "game"]
    );
    assert.equal(choice.focus, "game");
  });
});
