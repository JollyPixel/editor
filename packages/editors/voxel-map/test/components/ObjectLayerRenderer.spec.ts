// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import { AreaBox } from "@jolly-pixel/three";
import type {
  VoxelRenderer,
  VoxelObjectJSON,
  VoxelObjectLayerJSON,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../../src/EditorState.ts";
import { ObjectLayerRenderer } from "../../src/components/ObjectLayerRenderer.ts";

// CONSTANTS
const kCanvasSize = 200;

interface RendererHarness {
  renderer: ObjectLayerRenderer;
  areas: AreaBox[];
  updates: Array<{
    objectId: string;
    patch: Partial<VoxelObjectJSON>;
  }>;
  areaOf(objectId: string): AreaBox;
  press(clientX: number, clientY: number): void;
  drag(clientX: number, clientY: number): void;
  publish(event: VoxelLayerHookEvent): void;
}

function createObject(
  patch: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "spawn",
    name: "Spawn",
    x: 0,
    y: 0,
    z: 0,
    width: 2,
    height: 2,
    visible: true,
    ...patch
  };
}

function createLayer(
  patch: Partial<VoxelObjectLayerJSON> = {}
): VoxelObjectLayerJSON {
  return {
    id: "layer-1",
    name: "Objects",
    visible: true,
    order: 0,
    objects: [createObject()],
    ...patch
  };
}

function createHarness(
  layers: VoxelObjectLayerJSON[] = [createLayer()]
): RendererHarness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(1, 20, 1);
  camera.lookAt(1, 0, 1);
  camera.updateMatrixWorld(true);

  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => {
    return {
      left: 0,
      top: 0,
      right: kCanvasSize,
      bottom: kCanvasSize,
      width: kCanvasSize,
      height: kCanvasSize,
      x: 0,
      y: 0,
      toJSON: () => {
        return {};
      }
    };
  };

  const updates: RendererHarness["updates"] = [];
  const engine = {
    getObjectLayers: () => layers,
    getObjectLayer: (name: string) => layers.find(
      (layer) => layer.name === name
    ),
    updateObject: (
      _layerName: string,
      objectId: string,
      patch: Partial<VoxelObjectJSON>
    ) => {
      updates.push({ objectId, patch });
    }
  };

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
  const actor = actorValue as unknown as Actor;

  const renderer = new ObjectLayerRenderer(actor, {
    vr: { engine } as unknown as VoxelRenderer,
    camera
  });
  renderer.awake();

  const harness: RendererHarness = {
    renderer,
    updates,
    get areas(): AreaBox[] {
      return scene.children.filter(
        (child): child is AreaBox => child instanceof AreaBox
      );
    },
    areaOf(objectId: string): AreaBox {
      const area = harness.areas.find(
        (candidate) => candidate.label?.displayName ===
          layers
            .flatMap((layer) => layer.objects)
            .find((object) => object.id === objectId)?.name
      );
      assert.ok(area, `no area for ${objectId}`);

      return area;
    },
    press(clientX: number, clientY: number): void {
      scene.updateMatrixWorld(true);
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX,
        clientY
      }));
    },
    drag(clientX: number, clientY: number): void {
      for (const type of ["pointermove", "pointerup"]) {
        canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          button: 0,
          pointerId: 1,
          clientX,
          clientY
        }));
      }
    },
    publish(event: VoxelLayerHookEvent): void {
      editorState.dispatchLayerUpdated(event);
    }
  };

  return harness;
}

describe("ObjectLayerRenderer areas", () => {
  afterEach(() => {
    editorState.setSelection(null);
  });

  test("anchors one area per visible object on its min corner", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    assert.equal(harness.areas.length, 1);
    const area = harness.areaOf("spawn");
    assert.deepEqual(area.position.toArray(), [0, 0, 0]);
    assert.deepEqual(area.size.toArray(), [2, 1, 2]);

    harness.renderer.destroy();
  });

  test("draws every visible object layer, whatever is selected", () => {
    const layers = [
      createLayer(),
      createLayer({
        id: "layer-2",
        name: "Triggers",
        objects: [createObject({ id: "trigger", name: "Trigger", x: 8 })]
      })
    ];
    editorState.selectObjectLayer("Objects");
    const harness = createHarness(layers);

    // Visibility follows the eye toggles alone: selecting one layer no
    // longer blanks the others, nor does selecting a voxel layer.
    assert.equal(harness.areaOf("spawn").visible, true);
    assert.equal(harness.areaOf("trigger").visible, true);

    editorState.selectVoxelLayer("Ground");
    assert.equal(harness.areaOf("spawn").visible, true);
    assert.equal(harness.areaOf("trigger").visible, true);

    harness.renderer.destroy();
  });

  test("names only the selected object, to keep a dense map readable", () => {
    const layers = [
      createLayer({
        objects: [
          createObject(),
          createObject({ id: "door", name: "Door", x: 8 })
        ]
      })
    ];
    editorState.selectObjectLayer("Objects");
    const harness = createHarness(layers);

    assert.equal(harness.areaOf("spawn").label!.visible, false);
    assert.equal(harness.areaOf("door").label!.visible, false);

    editorState.selectObject({ layerName: "Objects", objectId: "door" });

    assert.equal(harness.areaOf("spawn").label!.visible, false);
    assert.equal(harness.areaOf("door").label!.visible, true);

    harness.renderer.destroy();
  });

  test("repaints an area in place when its color changes", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);
    const area = harness.areaOf("spawn");
    const { material } = area.fill;

    layers[0].objects[0].color = "#ff0000";
    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { color: "#ff0000" }
      }
    });

    assert.equal(area.color.getHexString(), "ff0000");
    assert.equal(area.fill.material, material);

    harness.renderer.destroy();
  });

  test("moves the existing area rather than rebuilding it", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);
    const area = harness.areaOf("spawn");

    layers[0].objects[0].x = 6;
    layers[0].objects[0].width = 4;
    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { x: 6, width: 4 }
      }
    });

    assert.equal(harness.areas.length, 1);
    assert.equal(harness.areaOf("spawn"), area);
    assert.deepEqual(area.position.toArray(), [6, 0, 0]);
    assert.deepEqual(area.size.toArray(), [4, 1, 2]);

    harness.renderer.destroy();
  });

  test("touches no GPU resource when a hook repeats the stored area", () => {
    // Rebuilding the edge buffers or the label texture from a UI event
    // destroys resources the frame being encoded still references.
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();
    const area = harness.areaOf("spawn");
    const positions = area.edges!.geometry.getAttribute("instanceStart");
    const { version } = area.label!.material.map!;

    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { visible: true }
      }
    });

    assert.equal(
      area.edges!.geometry.getAttribute("instanceStart"),
      positions
    );
    assert.equal(area.label!.material.map!.version, version);

    harness.renderer.destroy();
  });

  test("hides a hidden object rather than dropping its area", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);
    const area = harness.areaOf("spawn");

    layers[0].objects[0].visible = false;
    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { visible: false }
      }
    });

    assert.equal(harness.areas.length, 1);
    assert.equal(area.visible, false);

    layers[0].objects[0].visible = true;
    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { visible: true }
      }
    });

    assert.equal(area.visible, true);

    harness.renderer.destroy();
  });

  test("hides every area of a hidden object layer", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);

    layers[0].visible = false;
    harness.publish({
      action: "object-layer-updated",
      layerName: "Objects",
      metadata: {
        patch: { visible: false }
      }
    });

    assert.equal(harness.areas.length, 1);
    assert.equal(harness.areaOf("spawn").visible, false);

    harness.renderer.destroy();
  });

  test("drops the area of a removed object", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);

    layers[0].objects = [];
    harness.publish({
      action: "object-removed",
      layerName: "Objects",
      metadata: { objectId: "spawn" }
    });

    assert.equal(harness.areas.length, 0);

    harness.renderer.destroy();
  });
});

describe("ObjectLayerRenderer selection", () => {
  afterEach(() => {
    editorState.setSelection(null);
  });

  test("activates the area under the pointer", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    harness.press(kCanvasSize / 2, kCanvasSize / 2);
    assert.equal(harness.areaOf("spawn").state, "active");

    harness.renderer.destroy();
  });

  test("deselects when the pointer misses every area", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    harness.press(kCanvasSize / 2, kCanvasSize / 2);
    harness.press(0, 0);
    assert.equal(harness.areaOf("spawn").state, "idle");

    harness.renderer.destroy();
  });

  test("writes a dragged area back to the object layer", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    harness.press(kCanvasSize / 2, kCanvasSize / 2);
    harness.drag(kCanvasSize / 2 + 50, kCanvasSize / 2);

    const last = harness.updates.at(-1);
    assert.ok(last, "the drag persisted nothing");
    assert.equal(last.objectId, "spawn");
    assert.ok(last.patch.x! > 0, "the area did not move on X");
    assert.equal(last.patch.z, 0);
    assert.equal(last.patch.width, 2);
    assert.equal(last.patch.height, 2);

    harness.renderer.destroy();
  });

  test("attaches the gizmo from the selection alone", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    editorState.selectObject({ layerName: "Objects", objectId: "spawn" });
    assert.equal(harness.areaOf("spawn").state, "active");

    editorState.selectObjectLayer("Objects");
    assert.equal(harness.areaOf("spawn").state, "idle");

    harness.renderer.destroy();
  });

  test("publishes the picked object as the editor selection", () => {
    editorState.selectObjectLayer("Objects");
    const harness = createHarness();

    harness.press(kCanvasSize / 2, kCanvasSize / 2);

    assert.deepEqual(editorState.selectedObject, {
      layerName: "Objects",
      objectId: "spawn"
    });

    harness.renderer.destroy();
  });

  test("ignores the pointer outside object mode", () => {
    editorState.selectVoxelLayer("Ground");
    const harness = createHarness();

    harness.press(kCanvasSize / 2, kCanvasSize / 2);
    assert.equal(harness.areaOf("spawn").state, "idle");
    assert.equal(editorState.selectedObject, null);

    harness.renderer.destroy();
  });

  test("refuses to pick a locked area", () => {
    const layers = [
      createLayer({ objects: [createObject({ locked: true })] })
    ];
    editorState.selectObjectLayer("Objects");
    const harness = createHarness(layers);

    harness.press(kCanvasSize / 2, kCanvasSize / 2);

    assert.equal(harness.areaOf("spawn").state, "idle");
    assert.equal(editorState.selectedObject, null);

    harness.renderer.destroy();
  });

  test("detaches the gizmo the moment its object is locked", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);

    editorState.selectObject({ layerName: "Objects", objectId: "spawn" });
    assert.equal(harness.areaOf("spawn").state, "active");

    layers[0].objects[0].locked = true;
    harness.publish({
      action: "object-updated",
      layerName: "Objects",
      metadata: {
        objectId: "spawn",
        patch: { locked: true }
      }
    });

    assert.equal(harness.areaOf("spawn").state, "idle");

    harness.renderer.destroy();
  });

  test("falls back to the layer when the selected object is removed", () => {
    editorState.selectObjectLayer("Objects");
    const layers = [createLayer()];
    const harness = createHarness(layers);
    editorState.selectObject({ layerName: "Objects", objectId: "spawn" });

    layers[0].objects = [];
    harness.publish({
      action: "object-removed",
      layerName: "Objects",
      metadata: { objectId: "spawn" }
    });

    assert.equal(harness.areas.length, 0);
    assert.deepEqual(editorState.selection, {
      kind: "object-layer",
      name: "Objects"
    });

    harness.renderer.destroy();
  });
});
