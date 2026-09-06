// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  AreaBoxControls,
  type AreaBox,
  type AreaBoxDragEvent
} from "@jolly-pixel/three";
import type {
  VoxelLayerHookEvent,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type SelectionStore,
  type WorldStore
} from "../../../app/state/index.ts";
import {
  objectKey,
  objectPatchFromArea,
  parseObjectKey,
  sameObjectArea
} from "./objectArea.ts";
import { ObjectAreaScene } from "./ObjectAreaScene.ts";

// CONSTANTS
const kMinObjectSize = {
  x: 1,
  y: 1,
  z: 1
};

export interface ObjectLayerRendererOptions {
  world: VoxelWorld;
  camera: THREE.PerspectiveCamera;
  selection?: SelectionStore;
  worldStore?: WorldStore;
}

/** Owns object-area selection, picking and transform controls. */
export class ObjectLayerRenderer extends ActorComponent {
  #world: VoxelWorld;
  #camera: THREE.PerspectiveCamera;
  #selection: SelectionStore;
  #worldStore: WorldStore;
  #scene: ObjectAreaScene;
  #canvas: HTMLCanvasElement | null = null;
  #controls: AreaBoxControls | null = null;
  #selectedKey: string | null = null;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: ObjectLayerRendererOptions
  ) {
    super({
      actor,
      typeName: "ObjectLayerRenderer"
    });
    this.#world = options.world;
    this.#camera = options.camera;
    this.#selection = options.selection ?? editorState.selection;
    this.#worldStore = options.worldStore ?? editorState.world;
    this.#scene = new ObjectAreaScene({
      actor,
      world: options.world,
      onRemoving: this.#onAreaRemoving
    });
  }

  awake(): void {
    const canvas = this.actor.world.renderer.canvas;
    this.#canvas = canvas;

    const controls = new AreaBoxControls(this.#camera, canvas, {
      snap: 1,
      minSize: kMinObjectSize,
      moveAxes: "xyz",
      resizeAxes: "xz"
    });
    controls.addEventListener("start", this.#onDragStart);
    controls.addEventListener("change", this.#onDragChange);
    controls.addEventListener("end", this.#onDragEnd);
    this.#controls = controls;

    canvas.addEventListener("pointerdown", this.#onPointerDown, true);
    this.#subscriptions.push(
      this.#selection.watch("change", this.#onSelectionChange),
      this.#worldStore.watch("layerUpdated", this.#onLayerUpdated),
      this.#worldStore.watch("reset", this.#onWorldReset)
    );

    this.#syncAll();
  }

  override destroy(): void {
    this.#canvas?.removeEventListener(
      "pointerdown",
      this.#onPointerDown,
      true
    );
    this.#canvas = null;

    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    this.#controls?.dispose();
    this.#controls = null;
    this.#selectedKey = null;
    this.#scene.dispose();

    super.destroy();
  }

  #syncAll(): void {
    this.#scene.syncAll(this.#editingKey());
    this.#updateVisibility();
  }

  #syncLayer(
    layerName: string
  ): void {
    this.#scene.syncLayer(layerName, this.#editingKey());
    this.#updateVisibility();
  }

  #editingKey(): string | null {
    return this.#controls?.dragging === true ? this.#selectedKey : null;
  }

  readonly #onAreaRemoving = (key: string): void => {
    if (this.#selectedKey === key) {
      this.#detach();
    }
    if (this.#selectedObjectKey() === key) {
      this.#selection.selectObjectLayer(parseObjectKey(key).layerName);
    }
  };

  #updateVisibility(): void {
    const selectedKey = this.#selectedObjectKey();

    for (const [key, area] of this.#scene.entries) {
      area.visible = this.#scene.shown(key);
      if (area.label !== null) {
        area.label.visible = key === selectedKey;
      }
    }

    this.#syncGizmo(selectedKey);
  }

  #syncGizmo(
    selectedKey: string | null
  ): void {
    const controls = this.#controls;
    if (controls === null) {
      return;
    }

    const area = selectedKey === null ?
      undefined :
      this.#scene.area(selectedKey);
    if (
      selectedKey === null ||
      area === undefined ||
      !area.visible ||
      this.#scene.locked(selectedKey)
    ) {
      this.#detach();

      return;
    }

    if (this.#selectedKey !== selectedKey) {
      this.#selectedKey = selectedKey;
      controls.attach(area);
    }
  }

  #selectedObjectKey(): string | null {
    const selected = this.#selection.object;

    return selected === null ?
      null :
      objectKey(selected.layerName, selected.objectId);
  }

  #detach(): void {
    this.#controls?.detach();
    this.#selectedKey = null;
  }

  #pick(
    event: PointerEvent
  ): [string, AreaBox] | null {
    const canvas = this.#canvas;
    if (canvas === null) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    this.#pointer.set(
      (((event.clientX - rect.left) / rect.width) * 2) - 1,
      (-((event.clientY - rect.top) / rect.height) * 2) + 1
    );
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);

    const pickable = [...this.#scene.entries].filter(
      ([key, area]) => area.visible && !this.#scene.locked(key)
    );
    const hits = this.#raycaster.intersectObjects(
      pickable.map(([, area]) => area.fill),
      false
    );
    if (hits.length === 0) {
      return null;
    }

    return pickable.find(
      ([, area]) => area.fill === hits[0].object
    ) ?? null;
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    const controls = this.#controls;
    if (
      controls === null ||
      event.button !== 0 ||
      !this.#selection.isObjectContext ||
      controls.isOverHandle(event)
    ) {
      return;
    }

    const picked = this.#pick(event);
    if (picked === null) {
      const activeLayer = this.#selection.objectLayer;
      this.#selection.current = (
        activeLayer === null ?
          null :
          {
            kind: "object-layer",
            name: activeLayer
          }
      );

      return;
    }

    const [key, area] = picked;
    const { layerName, objectId } = parseObjectKey(key);
    this.#selectedKey = key;
    controls.attach(area, { from: event });
    this.#selection.selectObject({
      layerName,
      objectId
    });
  };

  readonly #onDragStart = (): void => {
    this.#selection.gizmoDragging = true;
  };

  readonly #onDragChange = (
    event: AreaBoxDragEvent
  ): void => this.#persist(event);

  readonly #onDragEnd = (
    event: AreaBoxDragEvent
  ): void => {
    this.#persist(event);
    this.#selection.gizmoDragging = false;
  };

  #persist(
    event: AreaBoxDragEvent
  ): void {
    const key = this.#selectedKey;
    if (key === null) {
      return;
    }

    const object = this.#scene.object(key);
    if (object === undefined) {
      return;
    }

    const patch = objectPatchFromArea(event.min, event.size);
    if (sameObjectArea(object, patch)) {
      return;
    }

    const { layerName, objectId } = parseObjectKey(key);
    this.#world.updateObjectInLayer(
      layerName,
      objectId,
      patch
    );
  }

  readonly #onSelectionChange = (): void => this.#updateVisibility();

  readonly #onWorldReset = (): void => this.#syncAll();

  readonly #onLayerUpdated = (
    event: VoxelLayerHookEvent
  ): void => {
    switch (event.action) {
      case "object-layer-added":
      case "object-layer-removed":
      case "object-layer-updated":
        this.#syncAll();
        break;
      case "object-added":
      case "object-removed":
      case "object-updated":
        this.#syncLayer(event.layerName);
        break;
      default:
        break;
    }
  };
}
