// Import Third-party Dependencies
import * as THREE from "three";
import {
  InputCombination,
  type KeyChordString
} from "@jolly-pixel/controls";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { MarqueeBox } from "@jolly-pixel/three";
import type {
  VoxelCoord,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

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
const kCancelShortcut = [
  "Escape"
] as const satisfies readonly KeyChordString[];

interface MarqueeGesture {
  anchored: boolean;
  startEyeHeight: number;
}

export interface MarqueeToolOptions {
  view: VoxelView;
  camera: THREE.PerspectiveCamera;
  tool: ToolStore;
  selection: Pick<SelectionStore, "voxelLayer">;
  placement: Pick<
    MapPlacement,
    "current" | "liftRegion" | "liftConnected"
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
  #gesture: MarqueeGesture | null = null;
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
    const cancel = (): boolean => this.#cancel();
    document.on("command", invalidateAim);
    this.#unsubscribers.push(
      () => document.off("command", invalidateAim),
      options.tool.subscribe("selectMode", cancel),
      actor.world.input.keyboard.bind(kCancelShortcut, cancel, {
        priority: 1
      })
    );
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
    this.#gesture = null;
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
      this.#gesture = null;
      this.#show(null);

      return;
    }

    const draft = this.#shown;
    const gesture = this.#gesture;
    if (gesture === null || draft === null) {
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

    if (this.#closing(gesture)) {
      this.#lift(draft);

      return;
    }
    if (gesture.anchored && !this.#pointerFree()) {
      return;
    }

    const corner = this.#corner(gesture, draft);
    if (corner !== null) {
      this.#show(draft.stretchedTo(corner));
    }
  }

  #cancel(): boolean {
    if (this.#gesture === null) {
      return false;
    }

    this.#gesture = null;
    this.#show(null);

    return true;
  }

  #closing(
    gesture: MarqueeGesture
  ): boolean {
    return gesture.anchored ?
      this.#pressed() :
      !this.actor.world.input.mouse.isDown("left");
  }

  #corner(
    gesture: MarqueeGesture,
    draft: MarqueeDraft
  ): VoxelCoord | null {
    const pointer = this.actor.world.input.mouse.viewportPositionTo(
      this.#pointer
    );
    if (gesture.anchored) {
      const aim = this.#aimer.resolve(pointer);
      if (aim !== null && aim.probe !== null) {
        return aim.remove;
      }
    }

    return this.#aimer.aimAtHeight(
      pointer,
      draft.start.y + Math.round(this.#eyeHeight() - gesture.startEyeHeight)
    );
  }

  #available(): boolean {
    return this.#placement.current === null;
  }

  #pointerFree(): boolean {
    const { input } = this.actor.world;

    return input.mouse.hovering &&
      !this.#pointerCapture.captured &&
      !InputCombination.Alt.evaluate(input);
  }

  #hoverable(): boolean {
    return this.#pointerFree() &&
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
    this.#aimer.invalidate();
    const aim = this.#aim();
    if (aim === null) {
      this.#show(null);

      return;
    }
    if (this.#tool.selectMode === "connected") {
      this.#show(null);
      this.#placement.liftConnected(layerName, aim.remove);

      return;
    }

    this.#gesture = {
      anchored: this.#tool.selectMode === "corners",
      startEyeHeight: this.#eyeHeight()
    };
    this.#show(MarqueeDraft.begin(layerName, aim.remove));
  }

  #eyeHeight(): number {
    return this.#camera.getWorldPosition(this.#eye).y;
  }

  #lift(
    draft: MarqueeDraft
  ): void {
    this.#gesture = null;
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
