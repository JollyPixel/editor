// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { TranslationControls } from "@jolly-pixel/three";
import type {
  VoxelWorld,
  VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type SelectionStore,
  type WorldStore
} from "../../../app/state/index.ts";

export interface VoxelLayerGizmoOptions {
  world: VoxelWorld;
  camera: THREE.PerspectiveCamera;
  selection?: SelectionStore;
  worldStore?: WorldStore;
}

export class VoxelLayerGizmo extends ActorComponent {
  #camera: THREE.PerspectiveCamera;
  #selection: SelectionStore;
  #worldStore: WorldStore;
  #controls: TranslationControls | null = null;
  #pivot = new THREE.Object3D();
  #pivotOffset = new THREE.Vector3();
  #activeLayer: string | null = null;
  #world: VoxelWorld;
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: VoxelLayerGizmoOptions
  ) {
    super({
      actor,
      typeName: "VoxelLayerGizmo"
    });
    this.#world = options.world;
    this.#camera = options.camera;
    this.#selection = options.selection ?? editorState.selection;
    this.#worldStore = options.worldStore ?? editorState.world;
  }

  awake(): void {
    const controls = new TranslationControls(
      this.#camera,
      this.actor.world.renderer.canvas,
      {
        space: "world",
        snap: 1,
        appearance: {
          size: 0.05,
          center: false,
          directions: "positive",
          handle: {
            kind: "arrow"
          },
          outline: {
            color: "#080b11"
          }
        }
      }
    );
    controls.addEventListener(
      "start",
      this.#onDraggingStarted
    );
    controls.addEventListener(
      "change",
      this.#onObjectChange
    );
    controls.addEventListener(
      "end",
      this.#onDraggingEnded
    );
    this.#controls = controls;

    this.actor.addChildren(
      controls.helper,
      this.#pivot
    );
    this.#subscriptions.push(
      this.#selection.watch(
        "gizmoLayerChange",
        this.setActiveLayer.bind(this)
      ),
      this.#worldStore.watch(
        "layerUpdated",
        this.#onLayerUpdated
      )
    );
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    this.#controls?.removeEventListener(
      "start",
      this.#onDraggingStarted
    );
    this.#controls?.removeEventListener(
      "change",
      this.#onObjectChange
    );
    this.#controls?.removeEventListener(
      "end",
      this.#onDraggingEnded
    );
    this.#controls?.detach();
    this.#controls?.dispose();
    this.#controls = null;
    this.#selection.gizmoDragging = false;

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
      !this.#world.getLayer(name)
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

    const layer = this.#world.getLayer(
      this.#activeLayer
    );
    if (!layer) {
      return;
    }

    const center = layer.worldCenter();

    this.#pivotOffset.set(
      center.x - layer.position.x,
      center.y - layer.position.y,
      center.z - layer.position.z
    );
    this.#pivot.position.copy(center);
  }

  readonly #onDraggingStarted = (): void => {
    this.#selection.gizmoDragging = true;
  };

  readonly #onDraggingEnded = (): void => {
    this.#selection.gizmoDragging = false;
  };

  readonly #onObjectChange = (): void => {
    if (!this.#activeLayer) {
      return;
    }
    const position = this.#pivot.position;
    this.#world.setLayerPosition(this.#activeLayer, {
      x: Math.round(position.x - this.#pivotOffset.x),
      y: Math.round(position.y - this.#pivotOffset.y),
      z: Math.round(position.z - this.#pivotOffset.z)
    });
  };

  readonly #onLayerUpdated = (event: VoxelLayerCommand): void => {
    if (event.layerName !== this.#activeLayer) {
      return;
    }
    if (
      event.action === "voxel-set" ||
      event.action === "voxel-removed" ||
      event.action === "voxels-set" ||
      event.action === "voxels-removed" ||
      event.action === "position-updated" ||
      event.action === "position-rebased"
    ) {
      this.#repositionPivot();
    }
  };
}
