// Import Third-party Dependencies
import * as THREE from "three";
import { type Actor } from "@jolly-pixel/engine";
import type {
  VoxelRenderer,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import { TransformGizmoBase } from "./TransformGizmoBase.ts";

export interface LayerGizmoOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
}

/**
 * Visual manipulator for repositioning a voxel layer in world space.
 * Uses THREE.js TransformControls
 * Activate by calling setActiveLayer(name) from the Layer panel.
 */
export class LayerGizmo extends TransformGizmoBase {
  #pivot = new THREE.Object3D();
  #pivotOffset = new THREE.Vector3();
  #activeLayer: string | null = null;
  #vr: VoxelRenderer;

  constructor(
    actor: Actor,
    options: LayerGizmoOptions
  ) {
    super(actor, options, "LayerGizmo");
    this.#vr = options.vr;
  }

  override awake(): void {
    super.awake();

    this.controls!.setSpace("world");
    this.controls!.setTranslationSnap(1);

    // Pivot is the object TransformControls manipulates.
    this.actor.addChildren(this.#pivot);

    // Apply offset when pivot is dragged.
    // The pivot sits at the voxel-content center, so subtract #pivotOffset
    // (center − original offset) to recover the true layer offset.
    this.controls!.addEventListener("objectChange", () => {
      if (!this.#activeLayer) {
        return;
      }
      const p = this.#pivot.position;
      this.#vr.setLayerOffset(this.#activeLayer, {
        x: Math.round(p.x - this.#pivotOffset.x),
        y: Math.round(p.y - this.#pivotOffset.y),
        z: Math.round(p.z - this.#pivotOffset.z)
      });
    });

    // Show/hide the gizmo when the user toggles it from the layer list.
    editorState.addEventListener("gizmoLayerChange", () => {
      this.setActiveLayer(editorState.gizmoLayer);
    });

    // Reposition pivot when voxels are placed/removed or the offset is changed
    // externally (e.g. via the LayerPanel inputs) on the active layer.
    editorState.addEventListener("layerUpdated", (e) => {
      const evt = (e as CustomEvent<VoxelLayerHookEvent>).detail;
      if (evt.layerName !== this.#activeLayer) {
        return;
      }
      if (
        evt.action === "voxel-set" ||
        evt.action === "voxel-removed" ||
        evt.action === "offset-updated"
      ) {
        this.#repositionPivot();
      }
    });
  }

  setActiveLayer(
    name: string | null
  ): void {
    this.#activeLayer = name;

    if (!this.controls) {
      return;
    }

    if (!name) {
      this.controls.detach();

      return;
    }

    if (!this.#vr.getLayer(name)) {
      this.controls.detach();

      return;
    }

    this.#repositionPivot();
    this.controls.attach(this.#pivot);
  }

  #repositionPivot(): void {
    if (!this.#activeLayer) {
      return;
    }

    const layer = this.#vr.getLayer(this.#activeLayer);
    if (!layer) {
      return;
    }

    const center = this.#vr.getLayerCenter(this.#activeLayer)!;
    this.#pivotOffset.set(
      center.x - layer.offset.x,
      center.y - layer.offset.y,
      center.z - layer.offset.z
    );
    this.#pivot.position.copy(center);
  }
}
