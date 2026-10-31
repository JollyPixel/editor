// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { gizmoSnap } from "../../src/features/viewport/gizmoSnap.ts";
import {
  SCENE_PREFERENCES,
  type ScenePreferences
} from "../../src/preferences.ts";

function sceneValues(
  overrides: Record<string, unknown>
): ScenePreferences {
  return new Preferences({
    overrides: [["scene", overrides]]
  }).values(SCENE_PREFERENCES);
}

describe("gizmoSnap", () => {
  test("leaves the gizmo free while snapping is off", () => {
    assert.deepEqual(gizmoSnap(sceneValues({}), "center"), {});
  });

  test("snaps centered content to cell centers and rotations in degrees", () => {
    const values = sceneValues({
      snap: true,
      snapMove: 2,
      snapRotate: 90
    });

    assert.deepEqual(gizmoSnap(values, "center"), {
      translate: 2,
      grid: 1,
      rotate: Math.PI / 2,
      scale: 0.1
    });
  });

  test("keeps the origin on grid lines for corner content or the lines setting", () => {
    const cases: [Record<string, unknown>, "center" | "corner"][] = [
      [{ snap: true }, "corner"],
      [{ snap: true, snapTo: "lines" }, "center"]
    ];

    for (const [overrides, origin] of cases) {
      const snap = gizmoSnap(sceneValues(overrides), origin);
      assert.strictEqual(snap.grid, 0);
      assert.strictEqual(snap.translate, 1);
    }
  });
});
