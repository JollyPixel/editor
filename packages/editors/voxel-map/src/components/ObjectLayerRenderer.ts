// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  AreaBox,
  AreaBoxControls,
  type AreaBoxDragEvent
} from "@jolly-pixel/three";
import type {
  VoxelRenderer,
  VoxelObjectJSON,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import {
  areaTransformOf,
  colorOf,
  isLocked,
  objectKey,
  objectPatchFromArea,
  parseObjectKey,
  sameObjectArea
} from "../features/object-layers/objectArea.ts";

// CONSTANTS
const kMinObjectSize = {
  x: 1,
  y: 1,
  z: 1
};

export interface ObjectLayerRendererOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
}

export class ObjectLayerRenderer extends ActorComponent {
  #vr: VoxelRenderer;
  #camera: THREE.PerspectiveCamera;
  #canvas: HTMLCanvasElement | null = null;
  #controls: AreaBoxControls | null = null;
  #areas = new Map<string, AreaBox>();
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
    this.#vr = options.vr;
    this.#camera = options.camera;
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
      editorState.on("selectionChange", this.#onSelectionChange),
      editorState.on("layerUpdated", this.#onLayerUpdated),
      editorState.on("worldReset", this.#onWorldReset)
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

    for (const key of [...this.#areas.keys()]) {
      this.#removeArea(key);
    }

    super.destroy();
  }

  #syncAll(): void {
    const layers = this.#vr.engine.world.getObjectLayers();
    const names = new Set(layers.map((layer) => layer.name));

    for (const key of [...this.#areas.keys()]) {
      if (!names.has(parseObjectKey(key).layerName)) {
        this.#removeArea(key);
      }
    }
    for (const layer of layers) {
      this.#syncLayer(layer.name);
    }
  }

  #syncLayer(
    layerName: string
  ): void {
    // Keep hidden areas allocated to avoid GPU churn on visibility changes.
    const objects = this.#vr.engine.world.getObjectLayer(
      layerName
    )?.objects ?? [];
    const alive = new Set(
      objects.map((object) => objectKey(layerName, object.id))
    );

    for (const key of [...this.#areas.keys()]) {
      if (
        parseObjectKey(key).layerName === layerName &&
        !alive.has(key)
      ) {
        this.#removeArea(key);
      }
    }
    for (const object of objects) {
      this.#syncObject(layerName, object);
    }

    this.#updateVisibility();
  }

  #syncObject(
    layerName: string,
    object: VoxelObjectJSON
  ): void {
    const key = objectKey(layerName, object.id);
    const { position, size } = areaTransformOf(object);
    const area = this.#areas.get(key);

    if (area === undefined) {
      const created = new AreaBox({
        position,
        size,
        color: colorOf(object),
        displayName: object.name
      });
      this.actor.addChildren(created);
      this.#areas.set(key, created);

      return;
    }

    if (
      this.#selectedKey === key &&
      this.#controls?.dragging === true
    ) {
      return;
    }

    area.position.set(position.x, position.y, position.z);
    area.size = size;

    const color = colorOf(object);
    if (area.color.getHexString() !== new THREE.Color(color).getHexString()) {
      area.color = color;
    }

    // Redrawing an unchanged label would re-upload its texture.
    if (area.label !== null && area.label.displayName !== object.name) {
      area.label.displayName = object.name;
    }
  }

  #removeArea(
    key: string
  ): void {
    const area = this.#areas.get(key);
    if (area === undefined) {
      return;
    }

    // Detach first because removeChildren() disposes the entire subtree.
    if (this.#selectedKey === key) {
      this.#detach();
    }
    this.actor.removeChildren(area);
    this.#areas.delete(key);

    // Preserve the layer selection after a remote object deletion.
    if (this.#selectedObjectKey() === key) {
      editorState.selectObjectLayer(
        parseObjectKey(key).layerName
      );
    }
  }

  // Area visibility follows eye toggles, not selection.
  #updateVisibility(): void {
    const selectedKey = this.#selectedObjectKey();

    for (const [key, area] of this.#areas) {
      area.visible = this.#isShown(key);
      if (area.label !== null) {
        // Show only the selected nameplate to avoid overlapping labels.
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

    const area = selectedKey === null
      ? undefined
      : this.#areas.get(selectedKey);
    if (
      selectedKey === null ||
      area === undefined ||
      !area.visible ||
      this.#isLockedKey(selectedKey)
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
    const selected = editorState.selectedObject;

    return selected === null
      ? null
      : objectKey(selected.layerName, selected.objectId);
  }

  #isShown(
    key: string
  ): boolean {
    const object = this.#objectOf(key);
    if (object === undefined) {
      return false;
    }

    const { layerName } = parseObjectKey(key);

    return this.#vr.engine.world.getObjectLayer(layerName)?.visible === true &&
      object.visible;
  }

  #isLockedKey(
    key: string
  ): boolean {
    const object = this.#objectOf(key);

    return object !== undefined && isLocked(object);
  }

  #objectOf(
    key: string
  ): VoxelObjectJSON | undefined {
    const { layerName, objectId } = parseObjectKey(key);

    return this.#vr.engine.world
      .getObjectLayer(layerName)
      ?.objects.find((candidate) => candidate.id === objectId);
  }

  #detach(): void {
    this.#controls?.detach();
    this.#selectedKey = null;
  }

  #pick(
    event: PointerEvent
  ): string | null {
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
    this.#raycaster.setFromCamera(
      this.#pointer,
      this.#camera
    );

    // Locked areas must not intercept picks for objects behind them.
    const pickable = [...this.#areas].filter(
      ([key, area]) => area.visible && !this.#isLockedKey(key)
    );
    const hits = this.#raycaster.intersectObjects(
      pickable.map(([, area]) => area.fill),
      false
    );
    if (hits.length === 0) {
      return null;
    }

    const hit = pickable.find(
      ([, area]) => area.fill === hits[0].object
    );

    return hit?.[0] ?? null;
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    const controls = this.#controls;
    // Let the brush handle pointer input outside object context.
    if (
      controls === null ||
      event.button !== 0 ||
      !editorState.isObjectContext ||
      controls.isOverHandle(event)
    ) {
      return;
    }

    const key = this.#pick(event);
    if (key === null) {
      editorState.setSelection(
        editorState.activeObjectLayer === null
          ? null
          : {
            kind: "object-layer",
            name: editorState.activeObjectLayer
          }
      );

      return;
    }

    // Attach with the pointer event to preserve the grab offset.
    const { layerName, objectId } = parseObjectKey(key);
    this.#selectedKey = key;
    controls.attach(this.#areas.get(key)!, { from: event });
    editorState.selectObject({
      layerName,
      objectId
    });
  };

  readonly #onDragStart = (): void => {
    editorState.setGizmoDragging(true);
  };

  readonly #onDragChange = (
    event: AreaBoxDragEvent
  ): void => this.#persist(event);

  readonly #onDragEnd = (
    event: AreaBoxDragEvent
  ): void => {
    this.#persist(event);
    editorState.setGizmoDragging(false);
  };

  #persist(
    event: AreaBoxDragEvent
  ): void {
    if (this.#selectedKey === null) {
      return;
    }

    const { layerName, objectId } = parseObjectKey(this.#selectedKey);
    const object = this.#vr.engine.world
      .getObjectLayer(layerName)
      ?.objects.find((candidate) => candidate.id === objectId);
    if (object === undefined) {
      return;
    }

    const patch = objectPatchFromArea(event.min, event.size);
    if (sameObjectArea(object, patch)) {
      return;
    }

    this.#vr.engine.world.updateObjectInLayer(
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
