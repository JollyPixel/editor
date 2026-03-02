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
  // Set to true when TransformControls "mouseDown" fires so the same click
  // that activates a handle does not immediately deselect the object.
  #skipNextSelect = false;

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

    // When the user presses down on a handle, mark that the next click
    // originating from the engine input system should be skipped for selection.
    this.controls!.addEventListener("mouseDown", () => {
      this.#skipNextSelect = true;
    });

    // Flush position / scale to VoxelObjectJSON once the drag ends.
    this.controls!.addEventListener("mouseUp", () => {
      this.#flushObjectTransform();
    });

    this.controls!.addEventListener("dragging-changed", (event) => {
      this.#isDragging = (event as THREE.Event & { value: boolean; }).value;
    });

    // In scale mode snap X/Z to 1-unit steps and lock Y to 1 (objects are
    // always 1 unit tall). The scale is clamped per-frame so the visual
    // feedback during drag already shows the snapped result.
    this.controls!.addEventListener("objectChange", () => {
      if (this.controls?.mode !== "scale") {
        return;
      }

      const group = this.#selectedObjectKey
        ? this.#visuals.getGroup(this.#selectedObjectKey)
        : null;
      const dims = this.#initialObjDimensions;

      if (!group || !dims) {
        return;
      }

      const targetW = Math.max(1, Math.round(dims.w * group.scale.x));
      group.scale.x = targetW / dims.w;

      const targetH = Math.max(1, Math.round(dims.h * group.scale.z));
      group.scale.z = targetH / dims.h;

      group.scale.y = 1;
    });

    // Deselect when the user switches away from an object layer.
    editorState.addEventListener("selectedLayerTypeChange", () => {
      if (editorState.selectedLayerType !== "object") {
        this.#detachControls();
      }
    });

    editorState.addEventListener("layerUpdated", (event) => {
      const evt = (event as CustomEvent<VoxelLayerHookEvent>).detail;
      if (
        evt.action === "object-layer-added" ||
        evt.action === "object-layer-removed" ||
        evt.action === "object-layer-updated"
      ) {
        this.#visuals.rebuildAll();
        this.#detachControls();
      }
      else if (
        evt.action === "object-added" ||
        evt.action === "object-removed" ||
        evt.action === "object-updated"
      ) {
        this.#visuals.rebuildLayer(evt.layerName);
        this.#reattachAfterRebuild(evt.layerName);
      }
    });
  }

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
      const layer = this.#vr.getObjectLayer(layerName);
      const obj = layer?.objects.find((o) => o.id === objId);
      if (obj) {
        this.#initialObjDimensions = { w: obj.width ?? 1, h: obj.height ?? 1 };
      }
      this.controls.attach(newGroup);
    }
    else {
      this.#detachControls();
    }
  }

  #trySelectObject(): void {
    const { input } = this.actor.world;
    this.#raycaster.setFromCamera(input.getMousePosition(), this.camera);

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

    const layer = this.#vr.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    this.#selectedObjectKey = key;
    this.#initialObjDimensions = { w: obj.width ?? 1, h: obj.height ?? 1 };

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

    const layer = this.#vr.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    const group = this.#visuals.getGroup(this.#selectedObjectKey);

    if (!obj || !group) {
      return;
    }

    if (this.controls.mode === "translate") {
      const w = obj.width ?? 1;
      const h = obj.height ?? 1;
      this.#vr.updateObject(layerName, objId, {
        x: Math.round(group.position.x - w / 2),
        y: Math.round(group.position.y - 0.5),
        z: Math.round(group.position.z - h / 2)
      });
    }
    else if (this.controls.mode === "scale") {
      // Scale is already snapped to integer steps by the objectChange handler,
      // so Math.round here is just a safety net.
      const dims = this.#initialObjDimensions!;
      const newW = Math.max(1, Math.round(dims.w * group.scale.x));
      const newH = Math.max(1, Math.round(dims.h * group.scale.z));
      const newX = Math.round(obj.x + dims.w / 2 - newW / 2);
      const newZ = Math.round(obj.z + dims.h / 2 - newH / 2);
      this.#vr.updateObject(layerName, objId, { x: newX, z: newZ, width: newW, height: newH });
    }
  }

  update(): void {
    if (editorState.selectedLayerType !== "object") {
      return;
    }

    const { input } = this.actor.world;

    // G = translate, Shift+S = scale — only when an object is selected.
    if (this.#selectedObjectKey && this.controls) {
      if (input.wasKeyJustPressed("KeyG")) {
        this.controls.setMode("translate");
      }
      else if (
        input.wasKeyJustPressed("KeyS") &&
        (input.isKeyDown("ShiftLeft") || input.isKeyDown("ShiftRight"))
      ) {
        this.controls.setMode("scale");
      }
    }

    // Handle object selection clicks (skip if a controls handle was just pressed).
    if (!this.#isDragging && input.wasMouseButtonJustPressed("left")) {
      if (this.#skipNextSelect) {
        this.#skipNextSelect = false;
      }
      else {
        this.#trySelectObject();
      }
    }
  }
}
