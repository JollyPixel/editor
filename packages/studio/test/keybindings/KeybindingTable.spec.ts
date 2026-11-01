// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CAMERA_PREFERENCES,
  RUNTIME_PREFERENCES
} from "@jolly-pixel/editor.host/preferences";
import { defineKeyBindings, Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { KeybindingTable } from "../../src/keybindings/KeybindingTable.ts";

// CONSTANTS
const kMap = defineKeyBindings({
  name: "map-keys",
  label: "Voxel map",
  defaults: {
    "tool.brush": "b",
    "edit.undo": "Mod+z",
    "edit.redo": ["Mod+y", "Mod+Shift+z"]
  },
  actions: {
    "tool.brush": {
      label: "Brush tool",
      group: "Tools"
    },
    "edit.undo": {
      label: "Undo",
      group: "Editing"
    },
    "edit.redo": {
      label: "Redo",
      group: "Editing"
    }
  }
});
const kPlatform = { apple: false };

describe("KeybindingTable", () => {
  test("lists each scope with chords, groups and what was customized", () => {
    const preferences = new Preferences({
      overrides: [["map-keys", { "tool.brush": ["p"] }]]
    });
    const [section, ...others] = new KeybindingTable(
      [RUNTIME_PREFERENCES, kMap],
      preferences,
      kPlatform
    ).sections();

    assert.equal(others.length, 0);
    assert.equal(section.customized, true);
    assert.deepEqual(section.groups.map((group) => [
      group.label,
      group.rows.map((row) => [row.label, row.chords.map((chord) => chord.label), row.customized])
    ]), [
      ["Tools", [["Brush tool", ["P"], true]]],
      ["Editing", [["Undo", ["Ctrl+Z"], false], ["Redo", ["Ctrl+Y", "Ctrl+Shift+Z"], false]]]
    ]);
  });

  test("filters by action label or chord label", () => {
    const table = new KeybindingTable([kMap], new Preferences(), kPlatform);

    assert.deepEqual(
      table.sections("shift+z")[0].groups.flatMap((group) => group.rows.map((row) => row.action)),
      ["edit.redo"]
    );
    assert.deepEqual(table.sections("nothing like it"), []);
  });

  test("labels held keys as the keyboard prints them, a two-sided modifier once", () => {
    const layout = { layout: new Map([["KeyW", "z"]]) };
    const [section] = new KeybindingTable(
      [CAMERA_PREFERENCES],
      new Preferences(),
      { ...kPlatform, layout }
    ).sections();
    const rows = section.groups.flatMap((group) => group.rows);

    assert.deepEqual(
      rows
        .filter((row) => row.action === "forward" || row.action === "down")
        .map((row) => [row.kind, row.chords.map((chord) => chord.label)]),
      [["key", ["Z", "↑"]], ["key", ["Shift"]]]
    );
  });

  test("names the unmodified shortcuts of other scopes a held key also triggers", () => {
    const preferences = new Preferences({
      overrides: [["camera", {
        forward: ["KeyN"],
        left: ["KeyB"],
        back: ["KeyZ"]
      }]]
    });
    const layout = {
      layout: new Map([["KeyN", "b"], ["KeyB", "n"]])
    };
    const [section] = new KeybindingTable(
      [CAMERA_PREFERENCES],
      preferences,
      {
        ...kPlatform,
        layout,
        shortcutScopes: [CAMERA_PREFERENCES, kMap]
      }
    ).sections();
    const rows = section.groups.flatMap((group) => group.rows);

    assert.deepEqual(
      rows
        .filter((row) => row.clashes.length > 0)
        .map((row) => [row.action, row.clashes]),
      [["forward", ["\"Brush tool\" (Voxel map)"]]]
    );
  });
});
