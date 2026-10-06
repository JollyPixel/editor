// Import Third-party Dependencies
import * as THREE from "three";
import { InputCombination } from "@jolly-pixel/controls";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { MarqueeBox } from "@jolly-pixel/three";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  PointerCapture,
  SelectionStore,
  ToolStore
} from "../../state/index.ts";
import {
  BrushAimResolver,
  type BrushAim
} from "../painting/interaction/BrushAimResolver.ts";
import { MarqueePresence } from "../placement/collaboration/MarqueePresence.ts";
import type { MapPlacement } from "../placement/MapPlacement.ts";
import { MarqueeDraft } from "./MarqueeDraft.ts";

// CONSTANTS
const kMarqueeShade = "#1a1a1a";
const kGroundPlaneSize = 4096;
const kMaxDistance = 512;

export interface MarqueeToolOptions {
  view: VoxelView;
  camera: THREE.PerspectiveCamera;
  tool: ToolStore;
  selection: Pick<SelectionStore, "voxelLayer">;
  placement: Pick<
    MapPlacement,
    "current" | "lifted" | "commit" | "liftRegion"
  >;
  pointer: PointerCapture;
  color: THREE.ColorRepresentation;
  onChange: () => void;
}

export class MarqueeTool extends ActorComponent {
  #camera: THREE.PerspectiveCamera;
  #tool: ToolStore;
  #selection: Pick<SelectionStore, "voxelLayer">;
  #placement: MarqueeToolOptions["placement"];
  #pointerCapture: PointerCapture;
  #onChange: () => void;
  #aimer: BrushAimResolver;
  #box: MarqueeBox;
  #pointer = new THREE.Vector2();
  #eye = new THREE.Vector3();
  #shown: MarqueeDraft | null = null;
  #dragging = false;
  #startEyeHeight = 0;
  #unsubscribers: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: MarqueeToolOptions
  ) {
    super({
      actor,
      typeName: "MarqueeTool"
    });
    this.#camera = options.camera;
    this.#tool = options.tool;
    this.#selection = options.selection;
    this.#placement = options.placement;
    this.#pointerCapture = options.pointer;
    this.#onChange = options.onChange;
    this.#aimer = new BrushAimResolver({
      camera: options.camera,
      solid: options.view.root,
      groundPlaneSize: kGroundPlaneSize,
      maxDistance: kMaxDistance
    });
    this.#box = new MarqueeBox({
      colors: [options.color, kMarqueeShade],
      xray: true
    });
    this.#box.name = "marquee-draft";
    this.#box.visible = false;

    const { document } = options.view;
    const invalidateAim = (): void => this.#aimer.invalidate();
    document.on("command", invalidateAim);
    this.#unsubscribers.push(() => document.off("command", invalidateAim));
  }

  get presence(): MarqueePresence | null {
    const shown = this.#shown;

    return shown === null ?
      null :
      new MarqueePresence(shown.layerName, shown.region);
  }

  awake(): void {
    this.actor.addChildren(this.#box);
  }

  override destroy(): void {
    for (const unsubscribe of this.#unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.#dragging = false;
    this.#show(null);
    this.#box.removeFromParent();
    this.#box.dispose();

    super.destroy();
  }

  update(): void {
    const layerName = this.#selection.voxelLayer;
    if (
      !this.#tool.selecting ||
      layerName === null ||
      !this.#available()
    ) {
      this.#dragging = false;
      this.#show(null);

      return;
    }

    const draft = this.#shown;
    if (!this.#dragging || draft === null) {
      if (this.#pressed()) {
        this.#begin(layerName);
      }
      else {
        const aim = this.#hoverable() ? this.#aim() : null;
        this.#show(
          aim === null ? null : MarqueeDraft.begin(layerName, aim.remove)
        );
      }

      return;
    }

    const { mouse } = this.actor.world.input;
    if (!mouse.isDown("left")) {
      this.#lift(draft);

      return;
    }

    const corner = this.#aimer.aimAtPlane(
      mouse.viewportPositionTo(this.#pointer),
      {
        axis: "y",
        value: draft.start.y + Math.round(
          this.#eyeHeight() - this.#startEyeHeight
        )
      }
    );
    if (corner !== null) {
      this.#show(draft.stretchedTo(corner));
    }
  }

  #available(): boolean {
    return this.#placement.lifted !== null ||
      this.#placement.current === null;
  }

  #pointerFree(): boolean {
    const { input } = this.actor.world;

    return input.mouse.hovering &&
      !this.#pointerCapture.captured &&
      !InputCombination.Alt.evaluate(input);
  }

  #hoverable(): boolean {
    return this.#pointerFree() &&
      this.#placement.current === null &&
      !this.actor.world.input.mouse.isDown("middle");
  }

  #pressed(): boolean {
    const { input } = this.actor.world;

    return this.#pointerFree() &&
      input.mouse.wasJustPressed("left") &&
      !InputCombination.Control.evaluate(input);
  }

  #aim(): BrushAim | null {
    return this.#aimer.resolve(
      this.actor.world.input.mouse.viewportPositionTo(this.#pointer)
    );
  }

  #begin(
    layerName: string
  ): void {
    this.#placement.commit();
    this.#aimer.invalidate();
    const aim = this.#aim();
    if (aim === null) {
      this.#show(null);

      return;
    }

    this.#startEyeHeight = this.#eyeHeight();
    this.#dragging = true;
    this.#show(MarqueeDraft.begin(layerName, aim.remove));
  }

  #eyeHeight(): number {
    return this.#camera.getWorldPosition(this.#eye).y;
  }

  #lift(
    draft: MarqueeDraft
  ): void {
    this.#dragging = false;
    this.#show(null);
    this.#placement.liftRegion(
      draft.layerName,
      draft.region
    );
  }

  #show(
    draft: MarqueeDraft | null
  ): void {
    const shown = this.#shown;
    if (draft === null ? shown === null : draft.equals(shown)) {
      return;
    }

    this.#shown = draft;
    if (draft === null) {
      this.#box.visible = false;
    }
    else {
      const { min } = draft.region;
      this.#box.position.set(min.x, min.y, min.z);
      this.#box.size = draft.region.size;
      this.#box.visible = true;
    }
    this.actor.world.invalidate();
    this.#onChange();
  }
}
