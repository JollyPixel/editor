// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { TransformControls } from "@jolly-pixel/three";
import type {
  VoxelWorld,
  VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocument } from "../../../document/index.ts";
import type {
  PointerCapture,
  SelectionStore
} from "../../../state/index.ts";
import { isLayerGeometryCommand } from "./layerGeometry.ts";

export interface VoxelLayerGizmoOptions {
  world: VoxelWorld;
  camera: THREE.PerspectiveCamera;
  selection: SelectionStore;
  pointer: PointerCapture;
  mapDocument: MapDocument;
}

export class VoxelLayerGizmo extends ActorComponent {
  #camera: THREE.PerspectiveCamera;
  #selection: SelectionStore;
  #pointerCapture: PointerCapture;
  #mapDocument: MapDocument;
  #controls: TransformControls | null = null;
  #anchor = new THREE.Object3D();
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
    this.#selection = options.selection;
    this.#pointerCapture = options.pointer;
    this.#mapDocument = options.mapDocument;
  }

  awake(): void {
    const controls = new TransformControls(
      this.#camera,
      this.actor.world.renderer.canvas,
      {
        mode: "translate",
        orientation: "world",
        snap: {
          translate: 1
        },
        appearance: {
          center: false,
          planes: false,
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
      this.#anchor
    );
    this.#subscriptions.push(
      this.#selection.subscribe(
        "gizmoLayerChange",
        this.setActiveLayer.bind(this)
      ),
      this.#mapDocument.subscribe(
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
    this.#pointerCapture.release(this);

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
    controls.attach(this.#anchor);
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

    this.#anchor.position.copy(layer.position);
    if (this.#controls !== null) {
      this.#controls.pivot = {
        x: center.x - layer.position.x,
        y: center.y - layer.position.y,
        z: center.z - layer.position.z
      };
    }
  }

  readonly #onDraggingStarted = (): void => {
    this.#pointerCapture.capture(this);
  };

  readonly #onDraggingEnded = (): void => {
    this.#pointerCapture.release(this);
  };

  readonly #onObjectChange = (): void => {
    if (!this.#activeLayer) {
      return;
    }
    const position = this.#anchor.position;
    this.#world.setLayerPosition(this.#activeLayer, {
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z)
    });
  };

  readonly #onLayerUpdated = (event: VoxelLayerCommand): void => {
    if (event.layerName !== this.#activeLayer) {
      return;
    }
    if (isLayerGeometryCommand(event)) {
      this.#repositionPivot();
    }
  };
}
