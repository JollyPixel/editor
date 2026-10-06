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
import type { MapDocumentSignals } from "../../document/index.ts";
import type { PointerCapture } from "../../state/index.ts";
import type { BlockRenderSources } from "../blocks/rendering/BlockRenderSources.ts";
import type { Placement } from "./Placement.ts";
import { PlacementPreview } from "./PlacementPreview.ts";
import type { PlacementStore } from "./PlacementStore.ts";
import {
  mirrorOf,
  quarterTurnOf
} from "./gizmoTransforms.ts";

export interface PlacementGizmoOptions {
  view: VoxelView;
  sources: BlockRenderSources;
  camera: THREE.PerspectiveCamera;
  placements: PlacementStore;
  pointer: PointerCapture;
  mapDocument: MapDocumentSignals;
  color: THREE.ColorRepresentation;
}

export class PlacementGizmo extends ActorComponent {
  #view: VoxelView;
  #camera: THREE.PerspectiveCamera;
  #placements: PlacementStore;
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
    this.#view = options.view;
    this.#camera = options.camera;
    this.#placements = options.placements;
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
      this.#placements.subscribe("change", this.#sync),
      this.#mapDocument.subscribe("templatesChanged", this.#resync),
      this.#mapDocument.subscribe("blockRegistryChanged", this.#rebuild),
      this.#mapDocument.subscribe("tilesetsChanged", this.#rebuild)
    );
    this.#sync(this.#placements.placement);
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
    placement: Placement | null
  ): void => {
    this.actor.world.invalidate();
    const template = placement?.source.resolve(this.#view.document.world);
    if (
      placement === null ||
      template === undefined
    ) {
      this.#pointerCapture.release(this);
      this.#controls?.detach();
      this.#preview.hide();
      if (placement !== null) {
        this.#placements.end();
      }

      return;
    }

    const { position } = placement;
    this.#pivot.set(
      position.x + 0.5,
      position.y + 0.5,
      position.z + 0.5
    );
    this.#preview.draw(placement, template);

    const { marquee } = this.#preview;
    const controls = this.#controls;
    if (controls !== null && controls.box !== marquee) {
      controls.attach(marquee);
    }
  };

  readonly #resync = (): void => {
    this.#sync(this.#placements.placement);
  };

  readonly #rebuild = (): void => {
    this.#preview.invalidate();
    this.#resync();
  };

  readonly #onDragStart = (): void => {
    this.#pointerCapture.capture(this);
  };

  readonly #onDragChange = (
    event: BoxDragEvent
  ): void => {
    const placement = this.#placements.placement;
    const template = placement?.source.resolve(this.#view.document.world);
    if (placement === null || template === undefined) {
      return;
    }

    this.#placements.move(placement.positionFor(template, event.min));
  };

  readonly #onRotate = (
    event: BoxRotateEvent
  ): void => {
    this.#placements.transform(quarterTurnOf(event.turns));
  };

  readonly #onFlip = (
    event: BoxFlipEvent
  ): void => {
    this.#placements.transform(mirrorOf(event.axis));
  };

  readonly #onDragEnd = (): void => {
    this.#pointerCapture.release(this);
  };
}
