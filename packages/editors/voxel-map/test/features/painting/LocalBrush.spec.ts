// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  mock,
  test
} from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { editorState } from "../../../src/app/state/index.ts";
import { LocalBrush } from "../../../src/features/painting/LocalBrush.ts";
import { BrushMesh } from "../../../src/features/painting/rendering/BrushMesh.ts";
import type { BrushCursor } from "../../../src/features/painting/model/brushCursor.ts";

type MouseAction = "left" | "right";

interface VoxelEntryLike {
  position: { x: number; y: number; z: number; };
}

interface BrushHarnessOptions {
  maxDistance?: number;
  filled?: boolean;
  stampInterval?: number;
  stampCells?: number;
}

interface BrushHarness {
  cursors: (BrushCursor | null)[];
  brush: LocalBrush;
  camera: THREE.PerspectiveCamera;
  operations: string[];
  removed: VoxelEntryLike[];
  placed: VoxelEntryLike[];
  previewUpdates: number;
  press(action: MouseAction): void;
  settle(): void;
  release(): void;
  setPointer(x: number, y: number): void;
  setMouseMoving(moving: boolean): void;
  setButtonDown(action: string | null): void;
  setHovering(hovering: boolean): void;
}

const kBrushes: LocalBrush[] = [];

afterEach(() => {
  for (const brush of kBrushes.splice(0)) {
    brush.destroy();
  }
});

function createHarness(
  options: BrushHarnessOptions = {}
): BrushHarness {
  const {
    maxDistance,
    filled = true,
    stampInterval,
    stampCells
  } = options;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
  camera.position.set(0.5, 10, 0.5);
  camera.lookAt(0.5, 0, 0.5);
  camera.updateMatrixWorld(true);

  let pressed: MouseAction | null = null;
  const down = new Set<string>();
  let mouseMoving = true;
  let hovering = true;
  const pointer = new THREE.Vector2();
  const operations: string[] = [];
  const placed: VoxelEntryLike[] = [];
  const removed: VoxelEntryLike[] = [];
  const layer = {
    getVoxelAt(): { blockId: number; } | undefined {
      return filled ? { blockId: 1 } : undefined;
    }
  };
  const engine = {
    root: new THREE.Group(),
    world: {
      getLayer: () => layer,
      setVoxelBulk(_name: string, entries: VoxelEntryLike[]): void {
        placed.push(...entries);
        operations.push(`set:${entries.length}`);
      },
      removeVoxelBulk(_name: string, entries: VoxelEntryLike[]): void {
        removed.push(...entries);
        operations.push(`remove:${entries.length}`);
      }
    },
    flush(): void {
      operations.push("flush");
    }
  };
  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      input: {
        keyboard: {
          isDown: () => false
        },
        mouse: {
          viewportPositionTo: <T extends THREE.Vector2>(out: T) => out.set(
            pointer.x,
            pointer.y
          ),
          isDown: (action: string) => down.has(action),
          isMoving: () => mouseMoving,
          get hovering() {
            return hovering;
          },
          wasJustPressed: (action: string) => action === pressed
        }
      },
      sceneManager: {
        componentsToBeStarted: [],
        getSource: () => scene
      }
    },
    addChildren(...objects: THREE.Object3D[]) {
      scene.add(...objects);

      return actorValue;
    },
    removeChildren(...objects: THREE.Object3D[]) {
      scene.remove(...objects);

      return actorValue;
    },
    addComponentAndGet<TComponent>(
      ComponentClass: new (actor: Actor) => TComponent
    ): TComponent {
      return new ComponentClass(actor);
    }
  };
  const actor = actorValue as unknown as Actor;
  const draw = mock.method(
    BrushMesh.prototype,
    "draw"
  );
  const brush = new LocalBrush(actor, {
    engine: engine as unknown as VoxelEngine,
    camera,
    groundPlaneSize: 10,
    maxDistance,
    stampInterval,
    stampCells
  });
  kBrushes.push(brush);

  const cursors: (BrushCursor | null)[] = [];
  brush.onCursorChange = (cursor) => cursors.push(cursor);

  return {
    brush,
    camera,
    operations,
    placed,
    removed,
    cursors,
    get previewUpdates(): number {
      return draw.mock.callCount();
    },
    press(action: MouseAction): void {
      pressed = action;
      down.add(action);
    },
    settle(): void {
      pressed = null;
    },
    release(): void {
      pressed = null;
      down.clear();
    },
    setPointer(x: number, y: number): void {
      pointer.set(x, y);
    },
    setMouseMoving(moving: boolean): void {
      mouseMoving = moving;
    },
    setButtonDown(action: string | null): void {
      down.clear();
      if (action !== null) {
        down.add(action);
      }
    },
    setHovering(value: boolean): void {
      hovering = value;
    }
  };
}

function resetEditorState(): void {
  mock.restoreAll();
  editorState.selection.clear();
  editorState.brush.size = 1;
}

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
    const harness = createHarness();

    harness.press("right");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["remove:1", "flush"]);
  });

  test("removes the cell resting on the ground the preview outlines", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

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

  // Frame deltas are seconds; 0.1 is long enough to stamp again.
  const kFrame = 0.1;

  test("keeps painting while the button stays down", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0);
    harness.brush.update(kFrame);

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
      harness.brush.update(kFrame);
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

  test("waits for the stamp interval before painting again", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ stampInterval: 70 });

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0);
    harness.brush.update(0.01);
    harness.brush.update(0.01);

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);

    harness.brush.update(0.07);

    assert.strictEqual(harness.operations.length, 4);
  });

  test("travels no further than its cell budget per stamp", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ stampCells: 2 });

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.5, 0);
    harness.brush.update(kFrame);

    assert.deepStrictEqual(harness.operations, [
      "set:1",
      "flush",
      "set:2",
      "flush"
    ]);
  });

  test("catches up with a pointer that stopped moving", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ stampCells: 1 });

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setPointer(0.3, 0);
    harness.setMouseMoving(false);
    const target = harness.placed.length;
    for (let stamp = 0; stamp < 4; stamp++) {
      harness.brush.update(kFrame);
    }

    assert.ok(
      harness.placed.length > target,
      "the stroke keeps walking toward the pointer it trails"
    );
  });

  test("stamps a cell once per stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.brush.update(kFrame);
    harness.brush.update(kFrame);

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
      harness.brush.update(kFrame);
    }

    assert.ok(
      harness.placed.every(({ position }) => position.y === 0),
      "every cell of the stroke sits on the plane of its first cell"
    );
  });

  test("a released button ends the stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.setPointer(0.3, 0);
    harness.brush.update(kFrame);

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("a stroke resumes only on a new press", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.release();
    harness.brush.update(kFrame);

    harness.setButtonDown("left");
    harness.setPointer(0.3, 0);
    harness.brush.update(kFrame);

    assert.deepStrictEqual(harness.operations, ["set:1", "flush"]);
  });

  test("the middle button interrupts the stroke", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press("left");
    harness.brush.update();
    harness.settle();
    harness.setButtonDown("middle");
    harness.brush.update(kFrame);

    harness.setButtonDown("left");
    harness.setPointer(0.3, 0);
    harness.brush.update(kFrame);

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
    const harness = createHarness({ maxDistance: 5 });

    harness.brush.update();

    assert.deepStrictEqual(harness.cursors, []);
    assert.strictEqual(harness.previewUpdates, 0);
  });

  test("places and removes nothing past the reach", () => {
    editorState.selection.selectVoxelLayer("Ground");
    const harness = createHarness({ maxDistance: 5 });

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
    const harness = createHarness({ maxDistance: 5 });

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
