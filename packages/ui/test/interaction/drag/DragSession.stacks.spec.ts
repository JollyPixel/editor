// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  startDragSession,
  type LiveReorder
} from "../../../src/interaction/drag/DragSession.ts";
import {
  column,
  pointer,
  rect
} from "../../helpers/interaction/dragSession.ts";

describe("Interaction.startDragSession stacks", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("a live stack moves its children in place of the overlay until left", () => {
    const source = document.createElement("div");
    document.body.append(source);
    const lines: number[] = [];
    const moves: string[] = [];
    const live: LiveReorder = {
      preview: (index) => {
        moves.push(`preview ${index}`);
      },
      rest: () => {
        moves.push("rest");
      }
    };
    startDragSession({
      source,
      event: pointer("pointerdown", 10, 10),
      ghostLabel: "Pane",
      zones: () => [{
        ...column("left", 0, lines),
        stacks: [{
          slot: 0,
          rect: rect(0, 0, 100, 40),
          candidates: [
            {
              start: 0,
              size: 50
            },
            {
              start: 50,
              size: 50
            }
          ],
          live
        }]
      }],
      onCommit: () => undefined
    });
    source.dispatchEvent(pointer("pointermove", 20, 20));
    source.dispatchEvent(pointer("pointermove", 90, 20));
    const overlay = document.querySelector<HTMLElement>(".jolly-drag-overlay");
    assert.ok(overlay !== null);
    assert.deepEqual(moves, ["preview 0", "preview 2"]);
    assert.equal(overlay.style.display, "none");
    assert.deepEqual(lines, []);

    source.dispatchEvent(pointer("pointermove", 50, 260));
    assert.deepEqual(moves, ["preview 0", "preview 2", "rest"]);
    assert.equal(overlay.style.display, "");
    assert.deepEqual(lines, [2]);

    source.dispatchEvent(pointer("pointerup", 50, 260));
  });
});
