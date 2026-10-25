// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  createSceneEnvironment,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { SelectionStore } from "../../src/state/SelectionStore.ts";

describe("SelectionStore", () => {
  test("drops the actors the document removes or loses in a reset", () => {
    const document = new SceneDocument();
    const selection = new SelectionStore(document);
    const first = document.addActor({ name: "First" })!;
    const second = document.addActor({ name: "Second" })!;
    selection.select([first, second]);

    document.remove(first);
    assert.deepEqual(selection.ids, [second]);

    document.load({
      environment: createSceneEnvironment(),
      actors: []
    });
    assert.deepEqual(selection.ids, []);
  });

  test("toggles an actor in as the primary selection and back out", () => {
    const selection = new SelectionStore(new SceneDocument());
    selection.select(["a"]);

    selection.toggle("b");
    assert.deepEqual(selection.ids, ["b", "a"]);

    selection.toggle("b");
    assert.deepEqual(selection.ids, ["a"]);
  });
});
