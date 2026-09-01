// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type {
  VoxelRenderer,
  VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";

export interface LayerGizmoOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
}

export class LayerGizmo extends ActorComponent {
  #camera: THREE.PerspectiveCamera;
  #controls: TransformControls | null = null;
  #pivot = new THREE.Object3D();
  #pivotOffset = new THREE.Vector3();
  #activeLayer: string | null = null;
  #vr: VoxelRenderer;
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: LayerGizmoOptions
  ) {
    super({
      actor,
      typeName: "LayerGizmo"
    });
    this.#vr = options.vr;
    this.#camera = options.camera;
  }

  awake(): void {
    const controls = new TransformControls(
      this.#camera,
      this.actor.world.renderer.canvas
    );
    controls.setMode("translate");
    controls.setSpace("world");
    controls.setTranslationSnap(1);
    controls.addEventListener(
      "dragging-changed",
      this.#onDraggingChanged
    );
    controls.addEventListener(
      "objectChange",
      this.#onObjectChange
    );
    this.#controls = controls;

    this.actor.addChildren(controls.getHelper(), this.#pivot);
    this.#subscriptions.push(
      editorState.on("gizmoLayerChange", this.setActiveLayer.bind(this)),
      editorState.on("layerUpdated", this.#onLayerUpdated)
    );
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    this.#controls?.removeEventListener(
      "dragging-changed",
      this.#onDraggingChanged
    );
    this.#controls?.removeEventListener(
      "objectChange",
      this.#onObjectChange
    );
    this.#controls?.detach();
    this.#controls?.dispose();
    this.#controls = null;

    super.destroy();
  }

  setActiveLayer(
    name: string | null
  ): void {
    this.#activeLayer = name;

    const controls = this.#controls;
    if (controls === null) {
      return;
    }

    if (
      name === null ||
      !this.#vr.engine.world.getLayer(name)
    ) {
      controls.detach();

      return;
    }

    this.#repositionPivot();
    controls.attach(this.#pivot);
  }

  #repositionPivot(): void {
    if (!this.#activeLayer) {
      return;
    }

    const layer = this.#vr.engine.world.getLayer(
      this.#activeLayer
    );
    if (!layer) {
      return;
    }

    const center = this.#vr.engine.world.getLayer(
      this.#activeLayer
    )?.centerToWorld() ?? null!;
    this.#pivotOffset.set(
      center.x - layer.offset.x,
      center.y - layer.offset.y,
      center.z - layer.offset.z
    );
    this.#pivot.position.copy(center);
  }

  readonly #onDraggingChanged = (
    event: { value: unknown; }
  ): void => {
    editorState.setGizmoDragging(event.value === true);
  };

  readonly #onObjectChange = (): void => {
    if (!this.#activeLayer) {
      return;
    }
    const position = this.#pivot.position;
    this.#vr.engine.world.setLayerOffset(this.#activeLayer, {
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
