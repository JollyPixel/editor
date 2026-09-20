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
import type { BrushShape } from "./model/brushFootprint.ts";
import {
  resolveFlipY,
  resolveRotation
} from "./model/brushOrientation.ts";
import {
  BrushStroke,
  type StrokeMode,
  type VoxelPaint
} from "./model/BrushStroke.ts";
import {
  ghostTargetOf,
  type GhostTarget
} from "./model/ghostTarget.ts";
import {
  BrushAimResolver,
  type BrushAim
} from "./interaction/BrushAimResolver.ts";
import {
  BrushPreview,
  type BrushTarget
} from "./rendering/BrushPreview.ts";
import { applyBrushStroke } from "./interaction/applyBrushStroke.ts";
import { pickBlockAt } from "./interaction/pickBlockAt.ts";
import { TileOpacityProbe } from "../blocks/tileOpacity.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultSkyRadius = 24;
const kAltClickTravelThreshold = 6;
const kStaleAimFrames = 2;

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
  onFocusRequest?: (point: THREE.Vector3Like) => void;

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
  #staleAimFrames = 0;
  #altClickTravel = 0;
  #unsubscribers: Array<() => void>;

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
      ghost: {
        blockRegistry: engine.blockRegistry,
        shapeRegistry: engine.shapeRegistry,
        tilesetManager: engine.tilesetManager,
        tileOpacity: new TileOpacityProbe(engine.tilesetManager)
      },
      ...color === undefined ? {} : { color },
      onCursorChange: (cursor) => this.onCursorChange?.(cursor)
    });
    const markDirty = () => this.#preview.markDirty();
    const markAimStale = () => {
      this.#staleAimFrames = kStaleAimFrames;
    };
    engine.on("command", markAimStale);
    this.#unsubscribers = [
      () => engine.off("command", markAimStale),
      brush.subscribe("sizeChange", markDirty),
      brush.subscribe("axisChange", markDirty),
      brush.subscribe("patternChange", markDirty),
      brush.subscribe("modeChange", markDirty),
      brush.subscribe("blockChange", markDirty),
      brush.subscribe("rotationModeChange", markDirty),
      brush.subscribe("flipYChange", markDirty),
      brush.subscribe("ghostChange", markDirty)
    ];
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
    for (const unsubscribe of this.#unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.#endStroke();
    this.#preview.destroy();
    super.destroy();
  }

  update() {
    this.#frameAim = undefined;
    this.#frameCenter = undefined;
    this.#refreshStaleAim();

    const { input } = this.actor.world;
    const isCtrl = input.keyboard.isDown("ControlLeft") ||
      input.keyboard.isDown("ControlRight");
    const isAlt = input.keyboard.isDown("AltLeft") ||
      input.keyboard.isDown("AltRight");

    if (
      !input.mouse.hovering ||
      this.#selection.isObjectContext ||
      input.mouse.isDown("middle")
    ) {
      this.#endStroke();
      this.#preview.hide();

      return;
    }

    if (isAlt) {
      this.#endStroke();
      this.#preview.hide();

      if (input.mouse.wasJustPressed("left")) {
        this.#altClickTravel = 0;
      }
      if (input.mouse.isDown("left")) {
        const delta = input.mouse.viewportDelta(false);
        this.#altClickTravel += Math.abs(delta.x) + Math.abs(delta.y);
      }
      if (
        input.mouse.wasJustReleased("left") &&
        this.#altClickTravel <= kAltClickTravelThreshold
      ) {
        this.#requestFocus();
      }

      return;
    }

    if (isCtrl) {
      this.#endStroke();
      if (input.mouse.wasJustPressed("left")) {
        this.#pickBlock();
      }
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
        this.#beginStroke(
          this.#brush.mode === "replace" ? "replace" : "place"
        );
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

    const cursor = this.#aimAtPlane(stroke);
    if (cursor === null) {
      return;
    }

    const center = stroke.steer(cursor);
    this.#frameCenter = center;
    if (!stroke.trails(center)) {
      return;
    }

    this.#apply(stroke, stroke.advance(center));
  }

  #pickBlock(): void {
    const center = this.#resolveAim()?.remove;
    if (center === undefined) {
      return;
    }

    const blockId = pickBlockAt(
      this.engine,
      {
        ...this.#shape(),
        position: center,
        anchor: this.#resolveAim()?.anchors.remove
      }
    );
    if (blockId !== null) {
      this.#brush.blockId = blockId;
    }
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

    const side = mode === "place" ? "place" : "remove";
    const { axis, pattern } = this.#brush;
    // Freeze orientation so camera movement cannot rotate a stroke midway.
    const paint = mode === "remove" ? undefined : this.#paint();
    const stroke = new BrushStroke({
      mode,
      layerName,
      paint,
      axis,
      pattern,
      origin: aim[side],
      anchor: aim.anchors[side]
    });

    this.#stroke = stroke;
    this.engine.history.begin();
    const cursor = this.#aimAtPlane(stroke);
    const target = cursor === null ?
      stroke.origin :
      stroke.steer(cursor);
    this.#frameCenter = target;
    this.#apply(stroke, stroke.advance(target));
  }

  #paint(): VoxelPaint {
    return {
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
    };
  }

  #endStroke(): void {
    if (this.#stroke === null) {
      return;
    }

    this.#stroke = null;
    this.engine.history.commit();
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

  #requestFocus(): void {
    const aim = this.#resolveAim();
    if (aim === null) {
      return;
    }

    const { remove: cell } = aim;
    this.onFocusRequest?.({
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      z: cell.z + 0.5
    });
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

  #aimAtPlane(
    stroke: BrushStroke
  ): VoxelCoord | null {
    const { input } = this.actor.world;

    return this.#aimer.aimAtPlane(
      input.mouse.viewportPositionTo(this.#pointer),
      stroke.plane
    );
  }

  #refreshStaleAim(): void {
    if (this.engine.pendingRebuilds > 0) {
      this.#staleAimFrames = kStaleAimFrames;
    }
    if (this.#staleAimFrames === 0) {
      return;
    }

    this.#staleAimFrames--;
    this.#aimer.invalidate();
    this.#preview.markDirty();
  }

  #shape(): BrushShape {
    const source = this.#stroke ?? this.#brush;

    return {
      size: this.#brush.size,
      axis: source.axis,
      pattern: source.pattern
    };
  }

  #updatePreview(): void {
    if (this.#selection.gizmoDragging) {
      this.#preview.hide();

      return;
    }

    this.#preview.update(
      this.actor.world.input.mouse.isMoving(),
      this.#shape(),
      () => this.#previewTarget(),
      () => this.#ghostTarget()
    );
  }

  #ghostTarget(): GhostTarget | null {
    const layerName = this.#selection.voxelLayer;
    if (layerName === null || !this.#brush.ghost) {
      return null;
    }

    const stroke = this.#stroke;
    const layer = this.engine.world.getLayer(layerName);

    return ghostTargetOf({
      enabled: this.#brush.ghost,
      size: this.#brush.size,
      mode: this.#brush.mode,
      aim: stroke === null ? this.#resolveAim() : null,
      stroke: stroke === null ? null : {
        paint: stroke.paint,
        center: this.#previewCenter()
      },
      paint: this.#paint(),
      occupied: (position) => layer?.getVoxelAt(position) !== undefined
    });
  }

  #previewTarget(): BrushTarget | null {
    const position = this.#previewCenter();
    if (position === null) {
      return null;
    }

    const stroke = this.#stroke;
    if (stroke !== null) {
      return {
        position,
        anchor: stroke.anchor
      };
    }

    const aim = this.#resolveAim();
    const anchor = aim?.anchors.remove;

    return aim?.face ?
      { position, anchor, face: aim.face } :
      { position, anchor };
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

    const cursor = this.#aimAtPlane(stroke);
    this.#frameCenter = cursor === null ?
      null :
      stroke.steer(cursor);

    return this.#frameCenter;
  }
}

function strokeButton(
  mode: StrokeMode
): "left" | "right" {
  return mode === "remove" ? "right" : "left";
}
