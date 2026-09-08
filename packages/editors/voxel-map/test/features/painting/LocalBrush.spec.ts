// Import Node.js Dependencies
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

// Import Internal Dependencies
import { editorState } from "../../../src/app/state/index.ts";
import {
  createHarness,
  resetEditorState,
  sortCells,
  type BrushHarness
} from "./brushHarness.ts";

describe("LocalBrush block picking", () => {
  afterEach(resetEditorState);

  test("adopts the block aimed at on ctrl left click", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      blocks: [{ x: 0, y: 0, z: 0, blockId: 5 }]
    });

    harness.setCtrl(true);
    harness.press("left");
    harness.brush.update();

    assert.equal(editorState.brush.blockId, 5);
  });

  test("paints nothing while picking", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      blocks: [{ x: 0, y: 0, z: 0, blockId: 5 }]
    });

    harness.setCtrl(true);
    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, []);
  });

  test("reads the block under a larger brush footprint", () => {
    editorState.selection.selectVoxelLayer("Ground");
    editorState.brush.size = 3;
    const harness = createHarness({
      blocks: [{ x: 1, y: 0, z: 1, blockId: 8 }]
    });

    harness.setCtrl(true);
    harness.press("left");
    harness.brush.update();

    assert.equal(editorState.brush.blockId, 8);
  });

  test("keeps the current block when the footprint is empty", () => {
    editorState.selection.selectVoxelLayer("Ground");
    editorState.brush.blockId = 3;
    const harness = createHarness();

    harness.setCtrl(true);
    harness.press("left");
    harness.brush.update();

    assert.equal(editorState.brush.blockId, 3);
    assert.deepStrictEqual(harness.operations, []);
  });
});

describe("LocalBrush mesh synchronization", () => {
  afterEach(resetEditorState);

  test("places every cell of the brush in one command", () => {
    editorState.selection.selectVoxelLayer("Ground");
    editorState.brush.size = 2;
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:4", "flush"]);
  });

  test("removes in one command and flushes", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ filled: true });

    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["remove:1", "flush"]);
  });

  test("removes the cell resting on the ground the preview outlines", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ filled: true });

    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(
      harness.removed.map(({ position }) => position),
      [{ x: 0, y: 0, z: 0 }]
    );
  });

  test("sends nothing when the footprint holds no voxel", () => {
    editorState.selection.selectVoxelLayer("Ground");
    editorState.brush.size = 3;
    const harness = createHarness({ filled: false });

    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, []);
  });

  test("edits nothing while no voxel layer is selected", () => {
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, []);
  });
});

describe("LocalBrush stroke", () => {
  afterEach(resetEditorState);

  test("keeps painting while the button stays down", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0);
    harness.brush.update();

    assert.strictEqual(
      harness.operations.filter((operation) => operation !== "flush").length,
      2
    );
  });

  test("walks the cells the pointer skipped over", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0);
    for (let stamp = 0; stamp < 3; stamp++) {
      harness.brush.update();
    }

    const positions = harness.placed.map(({ position }) => position);
    assert.ok(
      positions.length > 2,
      `expected a walked run, got ${positions.length} cells`
    );
    // A contiguous run: no two successive cells more than one step apart.
    for (let index = 1; index < positions.length; index++) {
      const previous = positions[index - 1];
      const current = positions[index];
      assert.ok(
        Math.abs(current.x - previous.x) <= 1 &&
        Math.abs(current.z - previous.z) <= 1,
        `gap between ${JSON.stringify(previous)} and ${JSON.stringify(current)}`
      );
    }
  });

  test("paints the whole run a fast pointer skipped in one stamp", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    const first = harness.placed.at(-1)!.position;
    harness.setPointer(0.5, 0);
    harness.brush.update();
    const last = harness.placed.at(-1)!.position;

    const steps = Math.max(
      Math.abs(last.x - first.x),
      Math.abs(last.z - first.z)
    );
    assert.ok(steps > 1, "the pointer skipped more than one cell");
    assert.strictEqual(harness.placed.length, steps + 1);
    assert.deepStrictEqual(harness.operations, [
      "set:1",
      "flush",
      `set:${steps}`,
      "flush"
    ]);
  });

  test("stamps a cell once per stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.brush.update();
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("stays on the plane it started on", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0.2);
    for (let stamp = 0; stamp < 3; stamp++) {
      harness.brush.update();
    }

    assert.ok(
      harness.placed.every(({ position }) => position.y === 0),
      "every cell of the stroke sits on the plane of its first cell"
    );
  });

  test("never paints over the block its first cell rests against", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      blocks: [{ x: 0, y: 0, z: 0 }]
    });
    harness.camera.position.set(0.5, 2.2, -3);
    harness.camera.lookAt(0.5, 0.85, 0);
    harness.camera.updateMatrixWorld(true);

    harness.press("left");
    harness.brush.update();
    harness.settle();
    for (let stamp = 0; stamp < 3; stamp++) {
      harness.brush.update();
    }

    assert.deepStrictEqual(
      harness.placed.map(({ position }) => position),
      [{ x: 0, y: 0, z: -1 }]
    );
  });

  test("holds still while the pointer stays on its cell", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      blocks: [{ x: 0, y: 0, z: 0 }]
    });
    harness.camera.position.set(0.5, 1.2, -3);
    harness.camera.lookAt(0.5, 0.4, 0);
    harness.camera.updateMatrixWorld(true);

    harness.press("left");
    harness.brush.update();
    harness.settle();
    for (const { position } of harness.placed) {
      harness.addBlock(position);
    }
    for (let stamp = 0; stamp < 3; stamp++) {
      harness.brush.update();
    }

    assert.deepStrictEqual(
      harness.placed.map(({ position }) => position),
      [{ x: 0, y: 0, z: -1 }]
    );
  });

  test("resumes once the pointer reaches another cell", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      blocks: [{ x: 0, y: 0, z: 0 }]
    });
    harness.camera.position.set(0.5, 1.2, -3);
    harness.camera.lookAt(0.5, 0.4, 0);
    harness.camera.updateMatrixWorld(true);

    harness.press("left");
    harness.brush.update();
    harness.settle();
    for (const { position } of harness.placed) {
      harness.addBlock(position);
    }
    harness.brush.update();
    harness.setPointer(0.5, 0);
    harness.brush.update();

    assert.ok(
      harness.placed.length > 1,
      "a moved pointer stamps again"
    );
  });

  test("removes exactly the cells a still cursor placed", () => {
    editorState.selection.selectVoxelLayer("Ground");
    editorState.brush.size = 2;
    const harness = createHarness();
    harness.camera.position.set(0.5, 6, -5.5);
    harness.camera.lookAt(0.5, 0, 0.5);
    harness.camera.updateMatrixWorld(true);

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.brush.update();
    for (const { position } of harness.placed) {
      harness.addBlock(position);
    }

    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(
      sortCells(harness.removed.map(({ position }) => position)),
      sortCells(harness.placed.map(({ position }) => position))
    );
  });

  test("a released button ends the stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.setPointer(0.3, 0);
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("a stroke resumes only on a new press", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.brush.update();

    harness.setButtonDown("left");
    harness.setPointer(0.3, 0);
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("the middle button interrupts the stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setButtonDown("middle");
    harness.brush.update();

    harness.setButtonDown("left");
    harness.setPointer(0.3, 0);
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });
});

describe("LocalBrush preview refresh gating", () => {
  afterEach(resetEditorState);

  test("recomputes the preview while the pointer moves", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 2);
  });

  test("skips the raycast when neither pointer nor camera moved", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.setMouseMoving(false);
    harness.brush.update();
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 1);
  });

  test("recomputes the preview after the camera moved", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.setMouseMoving(false);
    harness.brush.update();

    harness.camera.position.y += 4;
    harness.camera.updateMatrixWorld(true);
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 2);
  });

  test("hides the preview while the middle button steers the camera", () => {
    const harness = createHarness();

    harness.setButtonDown("middle");
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 0);
  });

  test("hides the preview while the pointer sits over the UI", () => {
    const harness = createHarness();

    harness.setHovering(false);
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 0);
  });

  test("refreshes the preview once the pointer returns to the viewport", () => {
    const harness = createHarness();

    harness.setHovering(false);
    harness.brush.update();

    harness.setHovering(true);
    harness.setMouseMoving(false);
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 1);
  });

  test("refreshes the preview once the camera drag ends", () => {
    const harness = createHarness();

    harness.setButtonDown("middle");
    harness.brush.update();

    harness.setButtonDown(null);
    harness.setMouseMoving(false);
    harness.brush.update();

    assert.strictEqual(harness.previewUpdates, 1);
  });
});

describe("LocalBrush cursor reporting", () => {
  afterEach(resetEditorState);

  test("reports the aimed cell and the current brush size", () => {
    const harness = createHarness();

    harness.brush.update();

    assert.deepStrictEqual(harness.cursors, [
      {
        position: { x: 0, y: 0, z: 0 },
        size: 1
      }
    ]);
  });

  test("stays silent while the aim and the size are unchanged", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.brush.update();

    assert.strictEqual(harness.cursors.length, 1);
  });

  test("reports again after the brush size changed", () => {
    const harness = createHarness();

    harness.brush.update();
    editorState.brush.size = 3;
    harness.brush.update();

    assert.deepStrictEqual(harness.cursors.at(-1), {
      position: { x: 0, y: 0, z: 0 },
      size: 3
    });
  });

  test("reports nothing aimed at while the camera is steered", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.setButtonDown("middle");
    harness.brush.update();

    assert.strictEqual(harness.cursors.at(-1), null);
  });

  test("reports nothing aimed at once the pointer leaves the viewport", () => {
    const harness = createHarness();

    harness.brush.update();
    harness.setHovering(false);
    harness.brush.update();

    assert.strictEqual(harness.cursors.at(-1), null);
  });
});

describe("LocalBrush reach", () => {
  afterEach(resetEditorState);

  test("aims at a surface within reach", () => {
    const harness = createHarness({ maxDistance: 20 });

    harness.brush.update();

    assert.deepStrictEqual(harness.cursors, [
      {
        position: { x: 0, y: 0, z: 0 },
        size: 1
      }
    ]);
  });

  test("aims at nothing past the reach", () => {
    const harness = createHarness({
      maxDistance: 5,
      skyRadius: 0
    });

    harness.brush.update();

    assert.deepStrictEqual(harness.cursors, []);
    assert.strictEqual(harness.previewUpdates, 0);
  });

  test("places and removes nothing past the reach", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({
      maxDistance: 5,
      skyRadius: 0
    });

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, []);
  });

  test("still edits a surface within reach", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ maxDistance: 20 });

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("aims again once the reach is widened", () => {
    const harness = createHarness({
      maxDistance: 5,
      skyRadius: 0
    });

    harness.brush.update();
    harness.brush.maxDistance = 20;
    harness.setMouseMoving(false);
    harness.brush.update();

    assert.deepStrictEqual(harness.cursors.at(-1), {
      position: { x: 0, y: 0, z: 0 },
      size: 1
    });
  });
});

describe("LocalBrush sky shell", () => {
  afterEach(resetEditorState);

  function aimAtTheSky(
    harness: BrushHarness
  ): void {
    harness.camera.position.set(0.5, 4.5, 0.5);
    harness.camera.lookAt(0.5, 20, 0.5);
    harness.camera.updateMatrixWorld(true);
  }

  test("catches the sky on the radius it ships with", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();
    aimAtTheSky(harness);

    assert.strictEqual(harness.brush.skyRadius, 24);

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(
      harness.placed.map(({ position }) => position),
      [{ x: 0, y: 28, z: 0 }]
    );
  });

  test("places a cell on the shell when nothing is under the ray", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ skyRadius: 10 });
    aimAtTheSky(harness);

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(
      harness.placed.map(({ position }) => position),
      [{ x: 0, y: 14, z: 0 }]
    );
  });

  test("paints nothing in the sky while the shell is disabled", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ skyRadius: 0 });
    aimAtTheSky(harness);

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, []);
  });

  test("drags a sky stroke along the height it started on", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ skyRadius: 10 });
    aimAtTheSky(harness);

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.2, 0);
    harness.brush.update();

    assert.ok(harness.placed.length > 1, "the stroke kept painting");
    assert.ok(
      harness.placed.every(({ position }) => position.y === 14),
      "every cell sits on the height the stroke started on"
    );
  });

  test("follows the shell radius it is given", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ skyRadius: 10 });
    aimAtTheSky(harness);
    harness.brush.skyRadius = 6;

    harness.press("left");
    harness.brush.update();

    assert.deepStrictEqual(
      harness.placed.map(({ position }) => position),
      [{ x: 0, y: 10, z: 0 }]
    );
  });
});
