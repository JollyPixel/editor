// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  BlockReorderController,
  type BlockMoveDetail
} from "../../../../src/features/blocks/library/BlockReorderController.ts";

// CONSTANTS
const kCellWidth = 10;
const kBlockIds = [11, 12, 13];

function setup() {
  const scroller = document.createElement("div");
  document.body.append(scroller);
  const controllers: ReactiveController[] = [];
  let updates = 0;
  const host: ReactiveControllerHost = {
    addController: (controller) => {
      controllers.push(controller);
    },
    removeController: () => undefined,
    requestUpdate: () => {
      updates++;
    },
    updateComplete: Promise.resolve(true)
  };
  const moves: BlockMoveDetail[] = [];
  const reorder = new BlockReorderController(host, {
    scroller: () => scroller,
    blockAt: (clientX) => kBlockIds[Math.floor(clientX / kCellWidth)] ?? null,
    insertIndexAt: (clientX) => Math.round(clientX / kCellWidth),
    blockIds: () => kBlockIds,
    onMove: (detail) => moves.push(detail)
  });

  return {
    scroller,
    controllers,
    reorder,
    moves,
    updates: () => updates
  };
}

function pointer(
  type: string,
  clientX: number,
  init: PointerEventInit = {}
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    clientX,
    clientY: 0,
    button: 0,
    ...init
  });
}

describe("BlockReorderController", () => {
  test("registers itself on the host", () => {
    const { controllers, reorder } = setup();

    assert.deepEqual(controllers, [reorder]);
  });

  test("moves the pressed block to the insertion point past the threshold", () => {
    const { scroller, reorder, moves, updates } = setup();

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 4));
    assert.equal(reorder.dragging, false);

    scroller.dispatchEvent(pointer("pointermove", 28));
    assert.equal(reorder.dragging, true);
    assert.equal(reorder.insertAt, 3);
    assert.ok(updates() > 0);

    scroller.dispatchEvent(pointer("pointerup", 28));
    assert.equal(reorder.dragging, false);
    assert.equal(reorder.insertAt, null);
    assert.deepEqual(moves, [{ id: 11, toIndex: 2 }]);
    assert.equal(reorder.consumeClick(), true);
    assert.equal(reorder.consumeClick(), false);
  });

  test("leaves a press below the threshold to the click", () => {
    const { scroller, reorder, moves } = setup();

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointerup", 3));

    assert.deepEqual(moves, []);
    assert.equal(reorder.consumeClick(), false);
  });

  test("ignores a drop that keeps the block in place", () => {
    const { scroller, reorder, moves } = setup();

    reorder.begin(pointer("pointerdown", 15));
    scroller.dispatchEvent(pointer("pointermove", 11));
    scroller.dispatchEvent(pointer("pointermove", 10));
    scroller.dispatchEvent(pointer("pointerup", 10));

    assert.deepEqual(moves, []);
  });

  test("Escape cancels the drag without reaching other key listeners", () => {
    const { scroller, reorder, moves } = setup();
    const escapes: string[] = [];
    function onKeyDown(
      event: KeyboardEvent
    ): void {
      escapes.push(event.key);
    }
    window.addEventListener("keydown", onKeyDown);

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 28));
    scroller.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true
    }));
    scroller.dispatchEvent(pointer("pointerup", 28));
    window.removeEventListener("keydown", onKeyDown);

    assert.equal(reorder.dragging, false);
    assert.deepEqual(moves, []);
    assert.deepEqual(escapes, []);
    assert.equal(reorder.consumeClick(), false);
  });

  test("cancels when the pointer capture is lost", () => {
    const { scroller, reorder, moves } = setup();

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 28));
    scroller.dispatchEvent(pointer("lostpointercapture", 28));
    scroller.dispatchEvent(pointer("pointerup", 28));

    assert.equal(reorder.dragging, false);
    assert.deepEqual(moves, []);
  });

  test("cancels when the host disconnects", () => {
    const { scroller, reorder, moves } = setup();

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 28));
    reorder.hostDisconnected();
    scroller.dispatchEvent(pointer("pointerup", 28));

    assert.equal(reorder.dragging, false);
    assert.equal(scroller.hasPointerCapture(1), false);
    assert.deepEqual(moves, []);
  });

  test("ignores secondary buttons and presses outside a block", () => {
    const { scroller, reorder } = setup();

    reorder.begin(pointer("pointerdown", 2, { button: 2 }));
    reorder.begin(pointer("pointerdown", 99));

    assert.equal(scroller.hasPointerCapture(1), false);
  });
});
