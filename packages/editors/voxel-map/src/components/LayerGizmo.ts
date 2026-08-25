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

export class LayerGizmo extends TransformGizmoBase {
  #pivot = new THREE.Object3D();
  #pivotOffset = new THREE.Vector3();
  #activeLayer: string | null = null;
  #vr: VoxelRenderer;
  #subscriptions: Array<() => void> = [];

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

    this.actor.addChildren(this.#pivot);
    this.controls!.addEventListener("objectChange", this.#onObjectChange);
    this.#subscriptions.push(
      editorState.on("gizmoLayerChange", this.setActiveLayer.bind(this)),
      editorState.on("layerUpdated", this.#onLayerUpdated)
    );
  }

  override destroy(): void {
    this.controls?.removeEventListener("objectChange", this.#onObjectChange);
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    super.destroy();
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

    if (!this.#vr.engine.getLayer(name)) {
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

    const layer = this.#vr.engine.getLayer(this.#activeLayer);
    if (!layer) {
      return;
    }

    const center = this.#vr.engine.getLayerCenter(this.#activeLayer)!;
    this.#pivotOffset.set(
      center.x - layer.offset.x,
      center.y - layer.offset.y,
      center.z - layer.offset.z
    );
    this.#pivot.position.copy(center);
  }

  readonly #onObjectChange = (): void => {
    if (!this.#activeLayer) {
      return;
    }
    const position = this.#pivot.position;
    this.#vr.engine.setLayerOffset(this.#activeLayer, {
      x: Math.round(position.x - this.#pivotOffset.x),
      y: Math.round(position.y - this.#pivotOffset.y),
      z: Math.round(position.z - this.#pivotOffset.z)
    });
  };

  readonly #onLayerUpdated = (event: VoxelLayerHookEvent): void => {
    if (event.layerName !== this.#activeLayer) {
      return;
    }
    if (
      event.action === "voxel-set" ||
      event.action === "voxel-removed" ||
      event.action === "offset-updated"
    ) {
      this.#repositionPivot();
    }
  };
}
