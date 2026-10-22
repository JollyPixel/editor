// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyBindingSettings,
  KeyboardLayoutStore,
  ShortcutLabels
} from "../../../../src/index.ts";
import { stubKeyboardLayout } from "../../../helpers/navigator.ts";

function setup() {
  const layout = new KeyboardLayoutStore();
  const settings = new KeyBindingSettings({
    defaults: {
      copy: "c",
      paste: ["v", "Shift+Insert"],
      forward: "KeyW",
      pick: []
    }
  });

  return {
    layout,
    settings,
    shortcuts: new ShortcutLabels(layout, settings)
  };
}

describe("Controls.ShortcutLabels", () => {
  test("appends the first chord of each bound action to the text", () => {
    const { settings, shortcuts } = setup();

    assert.equal(shortcuts.label("Edit", "copy", "paste"), "Edit (C / V)");
    assert.equal(shortcuts.label("Pick", "pick"), "Pick");
    assert.equal(shortcuts.label("Copy", "copy", "pick"), "Copy (C)");
    assert.equal(shortcuts.format("pick"), null);

    settings.assign("copy", ["x"]);
    assert.equal(shortcuts.label("Copy", "copy"), "Copy (X)");
  });

  test("names a key position by the letter the layout prints", async(t) => {
    const { layout, shortcuts } = setup();
    stubKeyboardLayout(t, [["KeyW", "z"]]);

    assert.equal(shortcuts.format("forward"), "W");
    await layout.refresh();
    assert.equal(shortcuts.format("forward"), "Z");
  });

  test("notifies on a rebind and a layout change until released", async(t) => {
    const { layout, settings, shortcuts } = setup();
    let changes = 0;
    const stop = shortcuts.subscribe(() => {
      changes++;
    });
    stubKeyboardLayout(t, [["KeyW", "z"]]);

    settings.assign("copy", ["x"]);
    await layout.refresh();
    assert.equal(changes, 2);

    stop();
    settings.reset();
    assert.equal(changes, 2);
  });
});
