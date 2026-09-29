// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Keyboard } from "@jolly-pixel/controls";
import { VoxelTransform } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TemplateStore } from "../../../src/features/templates/TemplateStore.ts";
import { bindTemplateShortcuts } from "../../../src/features/templates/placement/templateShortcuts.ts";

function setup() {
  const keyboard = new Keyboard();
  const templates = new TemplateStore();
  const release = bindTemplateShortcuts({
    keyboard,
    templates
  });

  function press(
    code: "KeyQ" | "KeyE",
    init: KeyboardEventInit = {}
  ): void {
    keyboard.emit(code, new KeyboardEvent("keydown", {
      code,
      ...init
    }));
  }

  return {
    templates,
    release,
    press
  };
}

function rotation(
  templates: TemplateStore
): number | undefined {
  return templates.placement?.transform.rotation;
}

describe("TemplateShortcuts", () => {
  test("Q and E turn the pending placement in opposite directions", () => {
    const { templates, press } = setup();
    templates.beginPlacement("house", { x: 0, y: 0, z: 0 });

    press("KeyQ");
    assert.equal(rotation(templates), 1);

    press("KeyE");
    press("KeyE");
    assert.equal(rotation(templates), 3);
  });

  test("does nothing without a pending placement", () => {
    const { templates, press } = setup();

    press("KeyQ");

    assert.equal(templates.placement, null);
  });

  test("ignores held keys and modifiers", () => {
    const { templates, press } = setup();
    templates.beginPlacement("house", { x: 0, y: 0, z: 0 });

    press("KeyQ", { repeat: true });
    press("KeyQ", { ctrlKey: true });
    press("KeyE", { shiftKey: true });

    assert.equal(templates.placement?.transform, VoxelTransform.Identity);
  });

  test("stops listening once disposed", () => {
    const { templates, release, press } = setup();
    templates.beginPlacement("house", { x: 0, y: 0, z: 0 });

    release();
    press("KeyQ");

    assert.equal(rotation(templates), 0);
  });
});
