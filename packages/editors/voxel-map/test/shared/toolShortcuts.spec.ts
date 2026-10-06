// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KeyBindings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindToolShortcuts } from "../../src/shared/toolShortcuts.ts";
import { ToolStore } from "../../src/state/index.ts";

function setup() {
  const keyboard = new KeyBindings();
  const tool = new ToolStore();
  bindToolShortcuts({
    keyboard,
    tool
  });

  function press(
    code: string,
    key: string
  ): boolean {
    return keyboard.dispatch(new KeyboardEvent("keydown", {
      code,
      key,
      cancelable: true
    }));
  }

  return {
    tool,
    press
  };
}

describe("ToolShortcuts", () => {
  it("picks the select tool on M and the brush on B", () => {
    const { tool, press } = setup();

    press("KeyM", "m");
    assert.equal(tool.current, "select");

    press("KeyB", "b");
    assert.equal(tool.current, "brush");
  });

  it("leaves the select tool for the brush on Escape", () => {
    const { tool, press } = setup();
    tool.current = "select";

    assert.equal(press("Escape", "Escape"), true);
    assert.equal(tool.current, "brush");
  });

  it("passes Escape on while the brush is active", () => {
    const { tool, press } = setup();

    assert.equal(press("Escape", "Escape"), false);
    assert.equal(tool.current, "brush");
  });
});
