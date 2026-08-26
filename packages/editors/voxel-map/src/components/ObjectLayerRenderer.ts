// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor
} from "@jolly-pixel/engine";
import type {
  VoxelRenderer,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import { normalizeVoxelExtent } from "../shared/voxelExtent.ts";
import { TransformGizmoBase } from "./TransformGizmoBase.ts";
import { ObjectLayerVisuals } from "./ObjectLayerVisuals.ts";

export interface ObjectLayerRendererOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
}

export class ObjectLayerRenderer extends TransformGizmoBase {
  #vr: VoxelRenderer;
  #visuals: ObjectLayerVisuals;

  #selectedObjectKey: string | null = null;
  #initialObjDimensions: { w: number; h: number; } | null = null;
  #raycaster = new THREE.Raycaster();
  #isDragging = false;
  #skipNextSelect = false;
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: ObjectLayerRendererOptions
  ) {
    super(
      actor,
      options,
      "ObjectLayerRenderer"
    );
    this.#vr = options.vr;
    this.#visuals = this.actor.addComponentAndGet(ObjectLayerVisuals, {
      vr: options.vr
    });
  }

  override awake(): void {
    super.awake();

    this.controls!.addEventListener("mouseDown", this.#onMouseDown);
    this.controls!.addEventListener("mouseUp", this.#onMouseUp);
    this.controls!.addEventListener("dragging-changed", this.#onDraggingChanged);
    this.controls!.addEventListener("objectChange", this.#onObjectChange);
    this.#subscriptions.push(
      editorState.on("selectionChange", this.#onSelectionChange),
      editorState.on("layerUpdated", this.#onLayerUpdated)
    );
  }

  override destroy(): void {
    this.controls?.removeEventListener("mouseDown", this.#onMouseDown);
    this.controls?.removeEventListener("mouseUp", this.#onMouseUp);
    this.controls?.removeEventListener("dragging-changed", this.#onDraggingChanged);
    this.controls?.removeEventListener("objectChange", this.#onObjectChange);
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    super.destroy();
  }

  readonly #onMouseDown = (): void => {
    this.#skipNextSelect = true;
  };

  readonly #onMouseUp = (): void => this.#flushObjectTransform();

  readonly #onDraggingChanged = (event: { value: unknown; }): void => {
    this.#isDragging = event.value === true;
  };

  readonly #onObjectChange = (): void => {
    if (this.controls?.mode !== "scale") {
      return;
    }

    const group = this.#selectedObjectKey
      ? this.#visuals.getGroup(this.#selectedObjectKey)
      : null;
    const dimensions = this.#initialObjDimensions;
    if (!group || !dimensions) {
      return;
    }

    const width = normalizeVoxelExtent(dimensions.w * group.scale.x);
    const height = normalizeVoxelExtent(dimensions.h * group.scale.z);
    group.scale.set(width / dimensions.w, 1, height / dimensions.h);
  };

  readonly #onSelectionChange = (): void => {
    if (editorState.selectedLayerType !== "object") {
      this.#detachControls();
    }
  };

  readonly #onLayerUpdated = (event: VoxelLayerHookEvent): void => {
    if (
      event.action === "object-layer-added" ||
      event.action === "object-layer-removed" ||
      event.action === "object-layer-updated"
    ) {
      this.#visuals.rebuildAll();
      this.#detachControls();
    }
    else if (
      event.action === "object-added" ||
      event.action === "object-removed" ||
      event.action === "object-updated"
    ) {
      this.#visuals.rebuildLayer(event.layerName);
      this.#reattachAfterRebuild(event.layerName);
    }
  };

  #reattachAfterRebuild(
    layerName: string
  ): void {
    if (
      !this.#selectedObjectKey?.startsWith(`${layerName}:`) ||
      !this.controls
    ) {
      return;
    }

    const newGroup = this.#visuals.getGroup(this.#selectedObjectKey);
    if (newGroup) {
      const objId = this.#selectedObjectKey.slice(layerName.length + 1);
      const layer = this.#vr.engine.getObjectLayer(layerName);
      const obj = layer?.objects.find((o) => o.id === objId);
      if (obj) {
        this.#initialObjDimensions = {
          w: normalizeVoxelExtent(obj.width ?? 1),
          h: normalizeVoxelExtent(obj.height ?? 1)
        };
      }
      this.controls.attach(newGroup);
    }
    else {
      this.#detachControls();
    }
  }

  #trySelectObject(): void {
    const { input } = this.actor.world;

    const viewportPosition = input.mouse.viewportPosition;
    this.#raycaster.setFromCamera(
      new THREE.Vector2(viewportPosition.x, viewportPosition.y),
      this.camera
    );

    const meshToKey = new Map<THREE.Mesh, string>();
    const fillMeshes: THREE.Mesh[] = [];
    for (const { key, mesh } of this.#visuals.getFillMeshes()) {
      fillMeshes.push(mesh);
      meshToKey.set(mesh, key);
    }

    const hits = this.#raycaster.intersectObjects(fillMeshes, false);
    if (hits.length > 0) {
      const key = meshToKey.get(hits[0].object as THREE.Mesh);
      if (key) {
        this.#selectObject(key);

        return;
      }
    }

    this.#detachControls();
  }

  #selectObject(
    key: string
  ): void {
    const colonIdx = key.lastIndexOf(":");
    const layerName = key.slice(0, colonIdx);
    const objId = key.slice(colonIdx + 1);

    const layer = this.#vr.engine.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    this.#selectedObjectKey = key;
    this.#initialObjDimensions = {
      w: normalizeVoxelExtent(obj.width ?? 1),
      h: normalizeVoxelExtent(obj.height ?? 1)
    };

    const group = this.#visuals.getGroup(key)!;
    this.controls?.attach(group);
  }

  #detachControls(): void {
    this.controls?.detach();
    this.#selectedObjectKey = null;
    this.#initialObjDimensions = null;
  }

  #flushObjectTransform(): void {
    if (!this.#selectedObjectKey || !this.controls) {
      return;
    }

    const colonIdx = this.#selectedObjectKey.lastIndexOf(":");
    const layerName = this.#selectedObjectKey.slice(0, colonIdx);
    const objId = this.#selectedObjectKey.slice(colonIdx + 1);

    const layer = this.#vr.engine.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    const group = this.#visuals.getGroup(this.#selectedObjectKey);

    if (!obj || !group) {
      return;
    }

    if (this.controls.mode === "translate") {
      const w = normalizeVoxelExtent(obj.width ?? 1);
      const h = normalizeVoxelExtent(obj.height ?? 1);
      this.#vr.engine.updateObject(layerName, objId, {
        x: Math.round(group.position.x - w / 2),
        y: Math.round(group.position.y - 0.5),
        z: Math.round(group.position.z - h / 2)
      });
    }
    else if (this.controls.mode === "scale") {
      const dims = this.#initialObjDimensions!;
      const newW = normalizeVoxelExtent(dims.w * group.scale.x);
      const newH = normalizeVoxelExtent(dims.h * group.scale.z);
      const newX = Math.round(obj.x + dims.w / 2 - newW / 2);
      const newZ = Math.round(obj.z + dims.h / 2 - newH / 2);
      this.#vr.engine.updateObject(layerName, objId, { x: newX, z: newZ, width: newW, height: newH });
    }
  }

  update(): void {
    if (editorState.selectedLayerType !== "object") {
      return;
    }

    const { input } = this.actor.world;

    if (this.#selectedObjectKey && this.controls) {
      if (input.keyboard.wasJustPressed("KeyG")) {
        this.controls.setMode("translate");
      }
      else if (
        input.keyboard.wasJustPressed("KeyS") &&
        (input.keyboard.isDown("ShiftLeft") || input.keyboard.isDown("ShiftRight"))
      ) {
        this.controls.setMode("scale");
      }
    }

    if (!this.#isDragging && input.mouse.wasJustPressed("left")) {
      if (this.#skipNextSelect) {
        this.#skipNextSelect = false;
      }
      else {
        this.#trySelectObject();
      }
    }
  }
}
