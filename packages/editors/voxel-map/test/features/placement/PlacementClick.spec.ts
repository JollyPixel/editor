// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { PlacementClick } from "../../../src/features/placement/PlacementClick.ts";
import { PointerCapture } from "../../../src/state/PointerCapture.ts";
import { sceneActor } from "../../helpers/actors.ts";

interface PressOptions {
  placing?: boolean;
  hovering?: boolean;
  pressed?: boolean;
  captured?: boolean;
  keys?: string[];
}

function press(
  options: PressOptions = {}
): number {
  const {
    placing = true,
    hovering = true,
    pressed = true,
    captured = false,
    keys = []
  } = options;

  const actor = sceneActor();
  Object.assign(actor.world, {
    input: {
      mouse: {
        hovering,
        wasJustPressed: (button: string) => pressed && button === "left"
      },
      keyboard: {
        isDown: (code: string) => keys.includes(code)
      }
    }
  });
  const pointer = new PointerCapture();
  if (captured) {
    pointer.capture({});
  }

  let commits = 0;
  const click = new PlacementClick(actor, {
    placement: {
      placing,
      commit: () => {
        commits++;

        return true;
      }
    },
    pointer
  });
  click.update();

  return commits;
}

describe("PlacementClick", () => {
  test("a left press on the viewport commits the pending placement", () => {
    assert.equal(press(), 1);
  });

  test("nothing is committed while no placement is pending", () => {
    assert.equal(press({ placing: false }), 0);
  });

  test("presses on the gizmo, off the viewport or without a click are ignored", () => {
    assert.equal(press({ captured: true }), 0);
    assert.equal(press({ hovering: false }), 0);
    assert.equal(press({ pressed: false }), 0);
  });

  test("Alt (camera pivot) and Ctrl (vertical lift) presses do not commit", () => {
    assert.equal(press({ keys: ["AltLeft"] }), 0);
    assert.equal(press({ keys: ["ControlRight"] }), 0);
  });
});
