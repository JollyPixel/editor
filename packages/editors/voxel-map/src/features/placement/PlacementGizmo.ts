// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  BoxControls,
  type BoxDragEvent,
  type BoxFlipEvent,
  type BoxRotateEvent,
  type MarqueeBox
} from "@jolly-pixel/three";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/MapDocument.ts";
import type { PointerCapture } from "../../state/index.ts";
import type { BlockRenderSources } from "../blocks/rendering/BlockRenderSources.ts";
import type { ActivePlacement } from "./ActivePlacement.ts";
import type { MapPlacement } from "./MapPlacement.ts";
import { PlacementPreview } from "./PlacementPreview.ts";
import {
  PLACEMENT_MIRRORS,
  PLACEMENT_ROTATIONS
} from "./placementTransforms.ts";

export interface PlacementGizmoOptions {
  view: VoxelView;
  sources: BlockRenderSources;
  camera: THREE.PerspectiveCamera;
  placement: Pick<
    MapPlacement,
    "current" | "subscribe" | "moveBoundsTo" | "turn"
  >;
  pointer: PointerCapture;
  mapDocument: MapDocumentSignals;
  color: THREE.ColorRepresentation;
}

export class PlacementGizmo extends ActorComponent {
  #camera: THREE.PerspectiveCamera;
  #placement: PlacementGizmoOptions["placement"];
  #pointerCapture: PointerCapture;
  #mapDocument: MapDocumentSignals;
  #preview: PlacementPreview;
  #pivot = new THREE.Vector3();
  #controls: BoxControls<MarqueeBox> | null = null;
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: PlacementGizmoOptions
  ) {
    super({
      actor,
      typeName: "PlacementGizmo"
    });
    this.#camera = options.camera;
    this.#placement = options.placement;
    this.#pointerCapture = options.pointer;
    this.#mapDocument = options.mapDocument;
    this.#preview = new PlacementPreview({
      blockRegistry: options.view.document.blocks,
      sources: options.sources,
      color: options.color
    });
  }

  awake(): void {
    const controls = new BoxControls<MarqueeBox>(
      this.#camera,
      this.actor.world.renderer.canvas,
      {
        snap: 1,
        moveAxes: "xyz",
        resizeAxes: "none",
        rotateAxes: "y",
        flipAxes: "xz",
        pivot: this.#pivot
      }
    );
    controls.addEventListener("start", this.#onDragStart);
    controls.addEventListener("change", this.#onDragChange);
    controls.addEventListener("rotate", this.#onRotate);
    controls.addEventListener("flip", this.#onFlip);
    controls.addEventListener("end", this.#onDragEnd);
    this.#controls = controls;

    this.actor.addChildren(this.#preview);
    this.#subscriptions.push(
      this.#placement.subscribe("change", this.#sync),
      this.#mapDocument.subscribe("blockRegistryChanged", this.#rebuild),
      this.#mapDocument.subscribe("tilesetsChanged", this.#rebuild)
    );
    this.#sync(this.#placement.current);
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    const controls = this.#controls;
    if (controls !== null) {
      controls.removeEventListener("start", this.#onDragStart);
      controls.removeEventListener("change", this.#onDragChange);
      controls.removeEventListener("rotate", this.#onRotate);
      controls.removeEventListener("flip", this.#onFlip);
      controls.removeEventListener("end", this.#onDragEnd);
      controls.dispose();
      this.#controls = null;
    }
    this.#pointerCapture.release(this);
    this.#preview.dispose();

    super.destroy();
  }

  readonly #sync = (
    current: ActivePlacement | null
  ): void => {
    this.actor.world.invalidate();
    if (current === null) {
      this.#pointerCapture.release(this);
      this.#controls?.detach();
      this.#preview.hide();

      return;
    }

    const { position } = current.placement;
    this.#pivot.set(
      position.x + 0.5,
      position.y + 0.5,
      position.z + 0.5
    );
    this.#preview.draw(
      current.placement,
      current.template
    );

    const { marquee } = this.#preview;
    const controls = this.#controls;
    if (controls !== null && controls.box !== marquee) {
      controls.attach(marquee);
    }
  };

  readonly #rebuild = (): void => {
    this.#preview.invalidate();
    this.#sync(this.#placement.current);
  };

  readonly #onDragStart = (): void => {
    this.#pointerCapture.capture(this);
  };

  readonly #onDragChange = (
    event: BoxDragEvent
  ): void => {
    this.#placement.moveBoundsTo(event.min);
  };

  readonly #onRotate = (
    event: BoxRotateEvent
  ): void => {
    const rotation = PLACEMENT_ROTATIONS.find(
      (candidate) => candidate.turns === event.turns
    );
    if (rotation !== undefined) {
      this.#placement.turn(rotation.transform);
    }
  };

  readonly #onFlip = (
    event: BoxFlipEvent
  ): void => {
    const mirror = PLACEMENT_MIRRORS.find(
      (candidate) => candidate.axis === event.axis
    );
    if (mirror !== undefined) {
      this.#placement.turn(mirror.transform);
    }
  };

  readonly #onDragEnd = (): void => {
    this.#pointerCapture.release(this);
  };
}
