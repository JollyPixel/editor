// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  HOST_PREFERENCES,
  definePreferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "../../../src/preferences/studioScope.ts";
import { SettingsSections } from "../../../src/shell/settings/SettingsSections.ts";

// CONSTANTS
const kVoxelMap = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: true
    }
  }
});
const kShortcutsOnly = definePreferences({
  name: "texture-keys",
  label: "Texture shortcuts",
  fields: {
    undo: {
      type: "chord",
      label: "Undo",
      default: ["Mod+z"]
    }
  }
});
const kScopes = [
  STUDIO_PREFERENCES,
  ...HOST_PREFERENCES,
  kVoxelMap,
  kShortcutsOnly
];

describe("SettingsSections", () => {
  test("gives the studio and host scopes to Appearance and every editor scope a page", () => {
    const sections = new SettingsSections({
      signedIn: true,
      scopes: kScopes
    });
    const appearance = sections.find("appearance");

    assert.deepEqual(sections.ids, [
      "profile",
      "appearance",
      "keybindings",
      "camera",
      "voxel-map"
    ]);
    assert.ok(appearance?.kind === "form");
    assert.deepEqual(
      appearance.scopes.map((scope) => scope.name),
      ["studio", "runtime", "lantern"]
    );
  });

  test("lists every scope with shortcuts on one Keybindings page", () => {
    const keybindings = new SettingsSections({
      signedIn: false,
      scopes: kScopes
    }).find("keybindings");

    assert.ok(keybindings?.kind === "keybindings");
    assert.deepEqual(
      keybindings.scopes.map((scope) => scope.name),
      ["texture-keys"]
    );
  });

  test("has no profile without an account", () => {
    const sections = new SettingsSections({
      signedIn: false,
      scopes: kScopes
    });

    assert.equal(sections.first?.id, "appearance");
    assert.equal(sections.find("profile"), undefined);
  });
});
