// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { editorState } from "../../src/EditorState.ts";
import { VoxelBrush } from "../../src/components/VoxelBrush.ts";

type MouseAction = "left" | "right";

interface BrushHarness {
  brush: VoxelBrush;
  operations: string[];
  publishPress(action: MouseAction): void;
}

function createHarness(): BrushHarness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
  camera.position.set(0.5, 10, 0.5);
  camera.lookAt(0.5, 0, 0.5);
  camera.updateMatrixWorld(true);

  let pressed: MouseAction | null = null;
  const operations: string[] = [];
  const engine = {
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
          viewportPosition: { x: 0, y: 0 },
          isDown: () => false,
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
  const brush = new VoxelBrush(actor, {
    vr: { engine } as unknown as VoxelRenderer,
    camera,
    groundPlaneSize: 10
  });

  return {
    brush,
    operations,
    publishPress(action: MouseAction): void {
      pressed = action;
    }
  };
}

describe("VoxelBrush mesh synchronization", () => {
  afterEach(() => {
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
