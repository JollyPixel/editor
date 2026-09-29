// Import Third-party Dependencies
import type * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  BoxControls,
  MarqueeBox,
  type BoxDragEvent
} from "@jolly-pixel/three";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../../document/index.ts";
import type { PointerCapture } from "../../../state/index.ts";
import type { TemplatePlacement as Placement, TemplateStore } from "../TemplateStore.ts";
import type { BlockRenderSources } from "../../blocks/blockGeometry.ts";
import {
  placementBounds,
  placementPositionOf
} from "./placementBounds.ts";
import { TemplateGhost } from "./TemplateGhost.ts";

// CONSTANTS
const kMarqueeColors = ["#ffd400", "#1a1a1a"] as const;

export interface TemplatePlacementOptions {
  engine: VoxelView;
  sources: BlockRenderSources;
  camera: THREE.PerspectiveCamera;
  templates: TemplateStore;
  pointer: PointerCapture;
  mapDocument: MapDocumentSignals;
}

export class TemplatePlacement extends ActorComponent {
  #engine: VoxelView;
  #camera: THREE.PerspectiveCamera;
  #templates: TemplateStore;
  #pointerCapture: PointerCapture;
  #mapDocument: MapDocumentSignals;
  #marquee = new MarqueeBox({
    colors: kMarqueeColors,
    xray: true
  });
  #ghost: TemplateGhost;
  #controls: BoxControls<MarqueeBox> | null = null;
  #subscriptions: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: TemplatePlacementOptions
  ) {
    super({
      actor,
      typeName: "TemplatePlacement"
    });
    this.#engine = options.engine;
    this.#camera = options.camera;
    this.#templates = options.templates;
    this.#pointerCapture = options.pointer;
    this.#mapDocument = options.mapDocument;
    this.#ghost = new TemplateGhost({
      blockRegistry: options.engine.document.blocks,
      sources: options.sources
    });
    this.#marquee.visible = false;
  }

  awake(): void {
    const controls = new BoxControls<MarqueeBox>(
      this.#camera,
      this.actor.world.renderer.canvas,
      {
        snap: 1,
        moveAxes: "xyz",
        resizeAxes: "none"
      }
    );
    controls.addEventListener("start", this.#onDragStart);
    controls.addEventListener("change", this.#onDragChange);
    controls.addEventListener("end", this.#onDragEnd);
    this.#controls = controls;

    this.actor.addChildren(this.#marquee, this.#ghost);
    this.#subscriptions.push(
      this.#templates.subscribe("placementChange", this.#sync),
      this.#mapDocument.subscribe("templatesChanged", this.#resync),
      this.#mapDocument.subscribe("blockRegistryChanged", this.#rebuild),
      this.#mapDocument.subscribe("tilesetsChanged", this.#rebuild)
    );
    this.#sync(this.#templates.placement);
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    const controls = this.#controls;
    if (controls !== null) {
      controls.removeEventListener("start", this.#onDragStart);
      controls.removeEventListener("change", this.#onDragChange);
      controls.removeEventListener("end", this.#onDragEnd);
      controls.dispose();
      this.#controls = null;
    }
    this.#pointerCapture.release(this);
    this.#ghost.dispose();
    this.#marquee.dispose();

    super.destroy();
  }

  readonly #sync = (
    placement: Placement | null
  ): void => {
    const template = placement === null ?
      undefined :
      this.#engine.document.world.templates.get(placement.templateId);
    if (placement === null || template === undefined) {
      this.#pointerCapture.release(this);
      this.#controls?.detach();
      this.#marquee.visible = false;
      this.#ghost.hide();
      if (placement !== null) {
        this.#templates.endPlacement();
      }

      return;
    }

    const { position, transform } = placement;
    const bounds = placementBounds(template, transform, position);
    this.#marquee.position.set(bounds.min.x, bounds.min.y, bounds.min.z);
    this.#marquee.size = bounds.size;
    this.#marquee.visible = true;
    this.#ghost.position.set(position.x, position.y, position.z);
    this.#ghost.draw(template, transform);

    const controls = this.#controls;
    if (controls !== null && controls.box !== this.#marquee) {
      controls.attach(this.#marquee);
    }
  };

  readonly #resync = (): void => {
    this.#sync(this.#templates.placement);
  };

  readonly #rebuild = (): void => {
    this.#ghost.invalidate();
    this.#resync();
  };

  readonly #onDragStart = (): void => {
    this.#pointerCapture.capture(this);
  };

  readonly #onDragChange = (
    event: BoxDragEvent
  ): void => {
    const placement = this.#templates.placement;
    const template = placement === null ?
      undefined :
      this.#engine.document.world.templates.get(placement.templateId);
    if (placement === null || template === undefined) {
      return;
    }

    this.#templates.movePlacement(
      placementPositionOf(template, placement.transform, event.min)
    );
  };

  readonly #onDragEnd = (): void => {
    this.#pointerCapture.release(this);
  };
}
