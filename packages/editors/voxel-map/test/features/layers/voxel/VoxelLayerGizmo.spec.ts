// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  SelectionStore,
  WorldStore
} from "../../../../src/app/state/index.ts";
import { VoxelLayerGizmo } from "../../../../src/features/layers/voxel/VoxelLayerGizmo.ts";

interface GizmoHarness {
  component: VoxelLayerGizmo;
  helper: THREE.Object3D;
  selection: SelectionStore;
}

function createHarness(): GizmoHarness {
  const scene = new THREE.Scene();
  const canvas = document.createElement("canvas");
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(8, 8, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  const selection = new SelectionStore();
  const worldStore = new WorldStore();
  const layer = {
    offset: new THREE.Vector3(1, 2, 3),
    centerToWorld: () => new THREE.Vector3(4, 5, 6)
  };
  const voxelWorld = {
    getLayer: (name: string) => (
      name === "Ground" ? layer : undefined
    ),
    setLayerOffset: () => void 0
  } as unknown as VoxelWorld;

  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    object3D: scene,
    world: {
      renderer: { canvas },
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
    }
  };
  const component = new VoxelLayerGizmo(
    actorValue as unknown as Actor,
    {
      world: voxelWorld,
      camera,
      selection,
      worldStore
    }
  );
  component.awake();

  const helper = scene.children.find(
    (child) => child.type === "TranslationGizmo"
  );
  assert.ok(helper, "translation helper was not mounted");

  return {
    component,
    helper,
    selection
  };
}

describe("VoxelLayerGizmo", () => {
  test("uses three outlined positive axis handles with no center picker", () => {
    const harness = createHarness();
    harness.selection.gizmoLayer = "Ground";

    const handleNames = harness.helper.children.map((child) => child.name);
    assert.deepEqual(handleNames, [
      "translation-handle-x-positive",
      "translation-handle-y-positive",
      "translation-handle-z-positive"
    ]);

    const outlines: THREE.Object3D[] = [];
    const pickers: THREE.Object3D[] = [];
    harness.helper.traverse((child) => {
      if (child.name === "translation-handle-outline") {
        outlines.push(child);
      }
      if (child.name === "translation-handle-picker") {
        pickers.push(child);
      }
    });

    assert.equal(outlines.length, 3);
    assert.equal(pickers.length, 3);
    assert.equal(
      harness.helper.getObjectByName("translation-center"),
      undefined
    );
    assert.equal(harness.helper.visible, true);

    harness.component.destroy();
  });

  test("draws every visible gizmo mesh in the transparent pass", () => {
    const harness = createHarness();
    harness.selection.gizmoLayer = "Ground";

    const opaque: string[] = [];
    let visibleMeshes = 0;
    harness.helper.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      const material = child.material as THREE.Material;
      if (!material.visible) {
        return;
      }
      visibleMeshes++;
      if (!material.transparent) {
        opaque.push(child.name);
      }
    });

    assert.equal(visibleMeshes, 6);
    assert.deepEqual(opaque, []);

    harness.component.destroy();
  });

  test("detaches the helper when no voxel layer is active", () => {
    const harness = createHarness();
    harness.selection.gizmoLayer = "Ground";
    harness.selection.gizmoLayer = null;

    assert.equal(harness.helper.visible, false);

    harness.component.destroy();
  });
});
