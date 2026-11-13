// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  KeyBindingSettings,
  KeyboardLayoutStore,
  ShortcutLabels
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import { AnimationKeyer } from "#src/features/animation/keys/AnimationKeyer.ts";
import { KeyToolController } from "#src/features/animation/keys/KeyToolController.ts";
import { MODEL_KEY_BINDINGS } from "#src/keybindings/modelActions.ts";
import {
  createAnimatedModel,
  createHost
} from "./fixtures.ts";

function createKeyTool() {
  const model = createAnimatedModel();
  model.tab.activate("animate");
  const arm = {
    uuid: model.ids.arm,
    transform: model.document.tree.nodes.block(model.ids.arm)!.transform
  };
  const keyBindings = new KeyBindingSettings({
    defaults: MODEL_KEY_BINDINGS
  });
  const host = createHost();
  const tool = new KeyToolController(host);
  tool.attach({
    access: model.access,
    animationSession: model.animationSession,
    selection: model.selection,
    keyer: new AnimationKeyer({
      document: model.document,
      history: model.history,
      session: model.animationSession,
      blocks: { get: (id) => (id === arm.uuid ? arm : undefined) },
      poser: { reset: () => undefined },
      access: model.access
    }),
    shortcuts: new ShortcutLabels(new KeyboardLayoutStore(), keyBindings)
  });
  function undoLabel(): string | null {
    return model.history.state(model.clipScope).undoLabel;
  }

  return { model, host, tool, keyBindings, undoLabel };
}

describe("KeyToolController", () => {
  test("keys the selected block, and nothing without a selection", () => {
    const { model, tool, undoLabel } = createKeyTool();
    const before = undoLabel();

    tool.key();
    assert.equal(undoLabel(), before);

    model.selection.select(model.ids.arm);
    tool.key();
    assert.equal(undoLabel(), "Key Arm");
  });

  test("shows in Animate, keys with a focused clip and the grant, and re-renders on change", () => {
    const { model, host, tool } = createKeyTool();
    function state() {
      return { shown: tool.shown, enabled: tool.enabled };
    }
    function rendersOn(change: () => void): boolean {
      const updates = host.updates;
      change();

      return host.updates > updates;
    }
    assert.deepEqual(state(), { shown: true, enabled: true });

    assert.equal(rendersOn(() => model.access.grant("hierarchy")), true);
    assert.deepEqual(state(), { shown: true, enabled: false });

    model.access.grant("animations");
    assert.equal(rendersOn(() => model.animationFocus.focusSet("walk")), true);
    assert.deepEqual(state(), { shown: true, enabled: false });

    model.animationFocus.focusClip("walk", model.clipId);
    assert.equal(rendersOn(() => model.tab.activate("texture")), true);
    assert.deepEqual(state(), { shown: false, enabled: false });
  });

  test("titles the key button with the chord the user bound", () => {
    const { tool, keyBindings } = createKeyTool();
    assert.equal(tool.title, "Key selected block (K)");

    keyBindings.assign("animation.key", ["j"]);
    assert.equal(tool.title, "Key selected block (J)");

    keyBindings.assign("animation.key", []);
    assert.equal(tool.title, "Key selected block");
  });
});
