// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  type VoxelCoord,
  type VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type BrushStore,
  type SelectionStore
} from "../../app/state/index.ts";
import type { BrushCursor } from "./model/brushCursor.ts";
import {
  resolveFlipY,
  resolveRotation
} from "./model/brushOrientation.ts";
import {
  BrushStroke,
  type StrokeMode
} from "./model/BrushStroke.ts";
import {
  BrushAimResolver,
  type BrushAim,
  type BrushHeightAim
} from "./interaction/BrushAimResolver.ts";
import { BrushPreview } from "./rendering/BrushPreview.ts";
import { applyBrushStroke } from "./interaction/applyBrushStroke.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultSkyRadius = 24;

export interface LocalBrushOptions {
  engine: VoxelEngine;
  camera: THREE.PerspectiveCamera;
  brush?: BrushStore;
  selection?: SelectionStore;
  /**
   * Fallback ground-plane side length, in world units.
   * @default 4096
   */
  groundPlaneSize?: number;
  /**
   * Maximum brush reach in world units; disables previews and edits beyond it.
   * @default 32
   */
  maxDistance?: number;
  /**
   * Camera-centred shell for aiming at empty sky, in world units; 0 disables
   * it and leaves the ground plane as the only fallback.
   * @default 24
   */
  skyRadius?: number;
  /**
   * Cursor tint, usually the local peer's collaboration color.
   */
  color?: THREE.ColorRepresentation;
}

/**
 * Paints fixed-height strokes and publishes the aimed cursor for peers.
 */
export class LocalBrush extends ActorComponent {
  /**
   * Fires when the aimed cursor changes; null means no target.
   */
  onCursorChange?: (cursor: BrushCursor | null) => void;

  readonly engine: VoxelEngine;

  #camera: THREE.PerspectiveCamera;
  #brush: BrushStore;
  #selection: SelectionStore;
  #aimer: BrushAimResolver;
  #preview: BrushPreview;
  #pointer = new THREE.Vector2();
  #stroke: BrushStroke | null = null;
  #frameAim: BrushAim | null | undefined;
  #frameCenter: VoxelCoord | null | undefined;

  constructor(
    actor: Actor,
    options: LocalBrushOptions
  ) {
    super({
      actor,
      typeName: "LocalBrush"
    });
    const {
      engine,
      camera,
      brush = editorState.brush,
      selection = editorState.selection,
      groundPlaneSize = 4096,
      maxDistance = kDefaultMaxDistance,
      skyRadius = kDefaultSkyRadius,
      color
    } = options;

    this.engine = engine;
    this.#camera = camera;
    this.#brush = brush;
    this.#selection = selection;
    this.#aimer = new BrushAimResolver({
      camera,
      solid: engine.root,
      groundPlaneSize,
      maxDistance,
      skyRadius
    });
    this.#preview = new BrushPreview({
      actor,
      camera,
      brush,
      ...color === undefined ? {} : { color },
      onCursorChange: (cursor) => this.onCursorChange?.(cursor)
    });
  }

  get maxDistance(): number {
    return this.#aimer.maxDistance;
  }

  set maxDistance(value: number) {
    if (value === this.#aimer.maxDistance) {
      return;
    }

    this.#aimer.maxDistance = value;
    this.#preview.markDirty();
  }

  get skyRadius(): number {
    return this.#aimer.skyRadius;
  }

  set skyRadius(
    value: number
  ) {
    if (value === this.#aimer.skyRadius) {
      return;
    }

    this.#aimer.skyRadius = value;
    this.#preview.markDirty();
  }

  override destroy(): void {
    this.#preview.destroy();
    super.destroy();
  }

  update() {
    this.#frameAim = undefined;
    this.#frameCenter = undefined;

    const { input } = this.actor.world;
    const isCtrl = input.keyboard.isDown("ControlLeft") ||
      input.keyboard.isDown("ControlRight");

    if (
      !input.mouse.hovering ||
      this.#selection.isObjectContext ||
      input.mouse.isDown("middle")
    ) {
      this.#endStroke();
      this.#preview.hide();

      return;
    }

    if (isCtrl) {
      this.#endStroke();
      if (input.mouse.isDown("scrollUp")) {
        this.#brush.resize(1);
        this.#preview.markDirty();
      }
      if (input.mouse.isDown("scrollDown")) {
        this.#brush.resize(-1);
        this.#preview.markDirty();
      }

      this.#updatePreview();

      return;
    }

    this.#updateStroke();
    this.#updatePreview();
  }

  #updateStroke(): void {
    const { input } = this.actor.world;

    if (this.#selection.gizmoDragging) {
      this.#endStroke();

      return;
    }

    const stroke = this.#stroke;
    if (stroke === null) {
      if (input.mouse.wasJustPressed("left")) {
        this.#beginStroke("place");
      }
      else if (input.mouse.wasJustPressed("right")) {
        this.#beginStroke("remove");
      }

      return;
    }

    if (!input.mouse.isDown(strokeButton(stroke.mode))) {
      this.#endStroke();

      return;
    }

    const aim = this.#aimAtHeight(stroke);
    if (aim === null) {
      return;
    }

    const center = stroke.steer(aim.cell, aim.cursor);
    this.#frameCenter = center;
    if (!stroke.trails(center)) {
      return;
    }

    this.#apply(stroke, stroke.advance(center));
  }

  #beginStroke(
    mode: StrokeMode
  ): void {
    const layerName = this.#selection.voxelLayer;
    if (layerName === null) {
      return;
    }

    const aim = this.#resolveAim();
    if (aim === null) {
      return;
    }

    const center = mode === "place" ? aim.place : aim.remove;
    // Freeze orientation so camera movement cannot rotate a stroke midway.
    const paint = mode === "place" ? {
      blockId: this.#brush.blockId,
      rotation: resolveRotation(
        this.#camera,
        this.#brush.rotationMode
      ),
      flipY: resolveFlipY(
        this.#camera,
        this.#brush.rotationMode,
        this.#brush.flipY
      )
    } : undefined;
    const stroke = new BrushStroke({
      mode,
      layerName,
      paint,
      height: center.y
    });

    this.#stroke = stroke;
    const target = stroke.steer(
      center,
      this.#aimAtHeight(stroke)?.cursor ?? center
    );
    this.#frameCenter = target;
    this.#apply(stroke, stroke.advance(target));
  }

  #endStroke(): void {
    this.#stroke = null;
  }

  #apply(
    stroke: BrushStroke,
    centers: Iterable<VoxelCoord>
  ): void {
    if (applyBrushStroke(
      this.engine,
      stroke,
      centers,
      this.#brush.size
    )) {
      this.#preview.markDirty();
    }
  }

  #resolveAim(): BrushAim | null {
    if (this.#frameAim !== undefined) {
      return this.#frameAim;
    }

    const { input } = this.actor.world;
    this.#frameAim = this.#aimer.resolve(
      input.mouse.viewportPositionTo(this.#pointer)
    );

    return this.#frameAim;
  }

  #aimAtHeight(
    stroke: BrushStroke
  ): BrushHeightAim | null {
    const { input } = this.actor.world;

    return this.#aimer.aimAtHeight(
      input.mouse.viewportPositionTo(this.#pointer),
      stroke.height,
      stroke.mode
    );
  }

  #updatePreview(): void {
    if (this.#selection.gizmoDragging) {
      this.#preview.hide();

      return;
    }

    this.#preview.update(
      this.actor.world.input.mouse.isMoving(),
      this.#brush.size,
      () => this.#previewCenter()
    );
  }

  #previewCenter(): VoxelCoord | null {
    if (this.#frameCenter !== undefined) {
      return this.#frameCenter;
    }

    const stroke = this.#stroke;
    if (stroke === null) {
      this.#frameCenter = this.#resolveAim()?.remove ?? null;

      return this.#frameCenter;
    }

    const aim = this.#aimAtHeight(stroke);
    this.#frameCenter = aim === null ?
      null :
      stroke.steer(aim.cell, aim.cursor);

    return this.#frameCenter;
  }
}

function strokeButton(
  mode: StrokeMode
): "left" | "right" {
  return mode === "place" ? "left" : "right";
}
