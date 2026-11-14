// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ExportTargets } from "../../../src/shell/export/ExportTargets.ts";
import { GENERAL_SECTION } from "../../../src/shell/settings/SettingsSections.ts";

// CONSTANTS
const kScene: AssetRecordData = {
  id: "scene-1",
  kind: "scene",
  path: "scenes/main.scene.json"
};
const kTargets = ExportTargets.STUDIO;

describe("ExportTargets", () => {
  test("opens on the target picked last time while it can export", () => {
    const cases = [
      { remembered: "", scene: kScene, expected: "web" },
      { remembered: "", scene: null, expected: "project" },
      { remembered: "project", scene: kScene, expected: "project" },
      { remembered: "web", scene: null, expected: "project" },
      { remembered: "gone", scene: kScene, expected: "web" }
    ];

    for (const { remembered, scene, expected } of cases) {
      assert.equal(
        kTargets.initial(remembered, scene).name,
        expected,
        `remembered "${remembered}", scene ${scene === null ? "unset" : "set"}`
      );
    }
  });

  test("blocks the web game until a default scene is set, pointing to its setting", () => {
    const web = kTargets.find("web");
    assert.ok(web);

    assert.equal(web.blocker(null)?.settingsSection, GENERAL_SECTION);
    assert.equal(web.blocker(kScene), null);
  });

  test("offers desktop and android as disabled tiles", () => {
    const disabled = kTargets.options()
      .filter((option) => option.disabled === true)
      .map((option) => option.value);

    assert.deepEqual(disabled, ["desktop", "android"]);
  });
});
