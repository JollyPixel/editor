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
  type BrushAim
} from "./interaction/BrushAimResolver.ts";
import { BrushPreview } from "./rendering/BrushPreview.ts";
import { applyBrushStroke } from "./interaction/applyBrushStroke.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultStampInterval = 70;
const kDefaultStampCells = 2;

export interface LocalBrushOptions {
  engine: VoxelEngine;
  camera: THREE.PerspectiveCamera;
  brush?: BrushStore;
  selection?: SelectionStore;
  /**
   * Side of the square ground plane the brush falls back to when the pointer
   * misses every voxel.
   * @default 4096
   */
  groundPlaneSize?: number;
  /**
   * How far from the camera the brush still reaches, in world units. Past it
   * nothing is previewed and no voxel is placed or removed.
   * @default 32
   */
  maxDistance?: number;
  /**
   * Tint of the cursor preview. Set it to the local peer's collaboration
   * color so this user's brush looks the same here as it does to peers.
   */
  color?: THREE.ColorRepresentation;
  /**
   * Shortest delay between two stamps of a held stroke, in milliseconds. The
   * press itself always stamps at once.
   * @default 70
   */
  stampInterval?: number;
  /**
   * How far a stroke may travel per stamp, in cells. Beyond it the stroke
   * trails the pointer and catches up over the next stamps instead of laying
   * the whole run down at once.
   * @default 2
   */
  stampCells?: number;
}

/**
 * Coordinates pointer input, stroke timing, preview presentation, and the
 * aimed cursor published for `PeerBrushes` to share.
 *
 * Holding a button paints a stroke: the cells under the pointer are edited as
 * it travels, once each, at the height the stroke started at.
 */
export class LocalBrush extends ActorComponent {
  /**
   * Fired when the aimed cursor moves or resizes, `null` when nothing is
   * aimed at.
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
  #stampInterval: number;
  #stampCells: number;
  #sinceStamp = 0;

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
      color,
      stampInterval = kDefaultStampInterval,
      stampCells = kDefaultStampCells
    } = options;

    this.engine = engine;
    this.#camera = camera;
    this.#brush = brush;
    this.#selection = selection;
    this.#aimer = new BrushAimResolver({
      camera,
      solid: engine.root,
      groundPlaneSize,
      maxDistance
    });
    this.#stampInterval = stampInterval;
    this.#stampCells = stampCells;

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

  get stampInterval(): number {
    return this.#stampInterval;
  }

  set stampInterval(value: number) {
    this.#stampInterval = Math.max(0, value);
  }

  get stampCells(): number {
    return this.#stampCells;
  }

  set stampCells(value: number) {
    this.#stampCells = Math.max(1, value);
  }

  override destroy(): void {
    this.#preview.destroy();
    super.destroy();
  }

  update(
    deltaTime = 0
  ) {
    this.#frameAim = undefined;
    this.#frameCenter = undefined;
    // The loop hands out seconds; the stamp interval reads in milliseconds.
    this.#sinceStamp += deltaTime * 1000;

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

    const center = this.#castOnPlane(stroke.height);
    if (center === null) {
      return;
    }

    this.#frameCenter = center;
    if (this.#sinceStamp < this.#stampInterval) {
      return;
    }
    if (!stroke.trails(center)) {
      return;
    }

    this.#sinceStamp = 0;
    this.#apply(stroke, stroke.advance(center, this.#stampCells));
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
    // Frozen for the whole stroke so a moving camera cannot reorient the
    // voxels laid down halfway through it.
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
    this.#frameCenter = center;
    this.#sinceStamp = 0;
    this.#apply(stroke, stroke.advance(center));
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

  #castOnPlane(
    height: number
  ): VoxelCoord | null {
    const { input } = this.actor.world;

    return this.#aimer.onPlane(
      input.mouse.viewportPositionTo(this.#pointer),
      height
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
    this.#frameCenter = stroke === null ?
      this.#resolveAim()?.remove ?? null :
      this.#castOnPlane(stroke.height);

    return this.#frameCenter;
  }
}

function strokeButton(
  mode: StrokeMode
): "left" | "right" {
  return mode === "place" ? "left" : "right";
}
