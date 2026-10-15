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

function setup(
  blockIds: readonly number[] = kBlockIds
) {
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
  const blocks = blockIds.map((id) => {
    return { id };
  });
  const layout = { top: 0 };
  const reorder = new BlockReorderController(host, {
    scroller: () => scroller,
    blocks: () => blocks,
    blockAt: (clientX) => blockIds[Math.floor(clientX / kCellWidth)] ?? null,
    cellOrigin: (index) => {
      return {
        clientX: index * kCellWidth,
        clientY: layout.top
      };
    },
    landingIndexAt: (clientX) => Math.min(
      Math.floor(clientX / kCellWidth),
      blockIds.length - 1
    ),
    onMove: (detail) => moves.push(detail)
  });

  return {
    scroller,
    controllers,
    reorder,
    blocks,
    layout,
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

  test("moves the pressed block to its landing cell past the threshold", () => {
    const { scroller, reorder, moves, updates } = setup();

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 4));
    assert.equal(reorder.dragging, false);

    scroller.dispatchEvent(pointer("pointermove", 28));
    assert.equal(reorder.dragging, true);
    assert.equal(reorder.drag?.blockId, 11);
    assert.equal(reorder.drag?.landing, 2);
    assert.ok(updates() > 0);

    scroller.dispatchEvent(pointer("pointerup", 28));
    assert.equal(reorder.dragging, false);
    assert.equal(reorder.drag, null);
    assert.deepEqual(moves, [{ id: 11, toIndex: 2 }]);
    assert.equal(reorder.consumeClick(), true);
    assert.equal(reorder.consumeClick(), false);
  });

  test("arranges the lifted block at its landing cell while dragging", () => {
    const { scroller, reorder, blocks } = setup();

    assert.equal(reorder.arranged, blocks);

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 28));
    const arranged = reorder.arranged;
    assert.deepEqual(arranged.map((block) => block.id), [12, 13, 11]);

    scroller.dispatchEvent(pointer("pointermove", 29));
    assert.equal(reorder.arranged, arranged);

    scroller.dispatchEvent(pointer("pointermove", 15));
    assert.deepEqual(reorder.arranged.map((block) => block.id), [12, 11, 13]);

    scroller.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true
    }));
    assert.equal(reorder.arranged, blocks);
  });

  test("keeps the grab offset measured at the press while the list scrolls", () => {
    const { scroller, reorder, layout } = setup();

    reorder.begin(pointer("pointerdown", 13, { clientY: 4 }));
    layout.top = -10;
    scroller.dispatchEvent(pointer("pointermove", 28, { clientY: 4 }));

    assert.deepEqual(reorder.drag?.grab, {
      clientX: 3,
      clientY: 4
    });
  });

  test("leaves a single block to the click", () => {
    const { scroller, reorder, moves } = setup([11]);

    reorder.begin(pointer("pointerdown", 2));
    scroller.dispatchEvent(pointer("pointermove", 28));
    scroller.dispatchEvent(pointer("pointerup", 28));

    assert.equal(scroller.hasPointerCapture(1), false);
    assert.equal(reorder.dragging, false);
    assert.deepEqual(moves, []);
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
