// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sceneWriteKeys } from "#src/model/footprint/SceneCommandKeys.ts";
import { SceneFootprint } from "#src/model/footprint/SceneFootprint.ts";
import { SceneTransform } from "#src/model/changes/SceneTransform.ts";
import type { SceneCommand } from "#src/network/types.ts";
import {
  actor,
  component
} from "../../helpers/scene.ts";

describe("sceneWriteKeys", () => {
  const structural: SceneCommand[] = [
    { action: "actor-added", actors: [actor("D")] },
    { action: "actor-removed", id: "A" },
    { action: "actor-moved", id: "A", parentId: null, transform: SceneTransform.create() },
    { action: "component-added", actorId: "A", component: component("c") },
    { action: "component-removed", actorId: "A", id: "c" },
    { action: "component-moved", actorId: "A", id: "c" }
  ];

  for (const command of structural) {
    test(`leaves ${command.action} to a rebase`, () => {
      assert.equal(sceneWriteKeys(command), null);
    });
  }

  test("keys a value write as the room does", () => {
    const command: SceneCommand = { action: "component-changed", id: "c", data: { a: 1 } };
    const roomKeys = SceneFootprint.unknown(command).conflictRefs().map((ref) => ref.key);

    assert.deepEqual(sceneWriteKeys(command), roomKeys);
  });
});
