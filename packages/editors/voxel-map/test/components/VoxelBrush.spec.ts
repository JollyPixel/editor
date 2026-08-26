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
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { editorState } from "../../src/EditorState.ts";
import { VoxelBrush } from "../../src/components/VoxelBrush.ts";
import { VoxelBrushPreview } from "../../src/components/VoxelBrushPreview.ts";

type MouseAction = "left" | "right";

interface BrushHarness {
  brush: VoxelBrush;
  camera: THREE.PerspectiveCamera;
  operations: string[];
  previewUpdates: number;
  publishPress(action: MouseAction): void;
  setMouseMoving(moving: boolean): void;
  setButtonDown(action: string | null): void;
}

function createHarness(): BrushHarness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
  camera.position.set(0.5, 10, 0.5);
  camera.lookAt(0.5, 0, 0.5);
  camera.updateMatrixWorld(true);

  let pressed: MouseAction | null = null;
  let buttonDown: string | null = null;
  let mouseMoving = true;
  const operations: string[] = [];
  const engine = {
    root: new THREE.Group(),
    setVoxel(): void {
      operations.push("set");
    },
    removeVoxel(): void {
      operations.push("remove");
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
          viewportPositionTo: <T extends THREE.Vector2>(out: T) => out.set(0, 0),
          isDown: (action: string) => action === buttonDown,
          isMoving: () => mouseMoving,
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
    addComponentAndGet<TComponent>(
      ComponentClass: new (actor: Actor) => TComponent
    ): TComponent {
      return new ComponentClass(actor);
    }
  };
  const actor = actorValue as unknown as Actor;
  const updateFromPositions = mock.method(
    VoxelBrushPreview.prototype,
    "updateFromPositions"
  );
  const brush = new VoxelBrush(actor, {
    vr: { engine } as unknown as VoxelRenderer,
    camera,
    groundPlaneSize: 10
  });

  return {
    brush,
    camera,
    operations,
    get previewUpdates(): number {
      return updateFromPositions.mock.callCount();
    },
    publishPress(action: MouseAction): void {
      pressed = action;
    },
    setMouseMoving(moving: boolean): void {
      mouseMoving = moving;
    },
    setButtonDown(action: string | null): void {
      buttonDown = action;
    }
  };
}

describe("VoxelBrush mesh synchronization", () => {
  afterEach(() => {
    mock.restoreAll();
    editorState.setSelectedLayer(null);
    editorState.setBrushSizeAbsolute(1);
  });

  test("flushes once after placing a complete brush footprint", () => {
    editorState.setSelectedLayer("Ground");
    editorState.setBrushSizeAbsolute(2);
    const harness = createHarness();

    harness.publishPress("left");
    harness.brush.update();

    assert.deepStrictEqual(
      harness.operations,
      ["set", "set", "set", "set", "flush"]
    );
  });

  test("flushes after removing a voxel", () => {
    editorState.setSelectedLayer("Ground");
    const harness = createHarness();

    harness.publishPress("right");
    harness.brush.update();

    assert.deepStrictEqual(harness.operations, ["remove", "flush"]);
  });
});

describe("VoxelBrush preview refresh gating", () => {
  afterEach(() => {
    mock.restoreAll();
    editorState.setSelectedLayer(null);
    editorState.setBrushSizeAbsolute(1);
  });

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
