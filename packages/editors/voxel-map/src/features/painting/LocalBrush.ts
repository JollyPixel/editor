// Import Third-party Dependencies
import * as THREE from "three";
import { InputCombination } from "@jolly-pixel/controls";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type {
  VoxelCoord,
  VoxelPart,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  BrushStore,
  PointerCapture,
  SelectionStore
} from "../../state/index.ts";
import {
  BrushFootprint,
  type BrushShape
} from "./model/BrushFootprint.ts";
import { brushOrientationOf } from "./model/brushOrientation.ts";
import { AimedHalf } from "./model/AimedHalf.ts";
import {
  BrushStroke,
  canMergePaint,
  type StrokeMode,
  type VoxelPaint
} from "./model/BrushStroke.ts";
import {
  ghostTargetOf,
  partGhostOf,
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
import type { BlockRenderSources } from "../blocks/rendering/BlockRenderSources.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultSkyRadius = 24;
const kAltClickTravelThreshold = 6;
const kStaleAimFrames = 2;

export interface LocalBrushOptions {
  view: VoxelView;
  sources: BlockRenderSources;
  camera: THREE.PerspectiveCamera;
  brush: BrushStore;
  selection: SelectionStore;
  pointer: PointerCapture;
  groundPlaneSize?: number;
  maxDistance?: number;
  skyRadius?: number;
  color?: THREE.ColorRepresentation;
  onCursorChange: (cursor: BrushFootprint | null) => void;
  onFocusRequest: (point: THREE.Vector3Like) => void;
  onPaintBlocked: () => void;
}

export class LocalBrush extends ActorComponent {
  readonly view: VoxelView;

  #camera: THREE.PerspectiveCamera;
  #brush: BrushStore;
  #selection: SelectionStore;
  #pointerCapture: PointerCapture;
  #onFocusRequest: (point: THREE.Vector3Like) => void;
  #onPaintBlocked: () => void;
  #aimer: BrushAimResolver;
  #preview: BrushPreview;
  #pointer = new THREE.Vector2();
  #stroke: BrushStroke | null = null;
  #frameAim: BrushAim | null | undefined;
  #frameCenter: VoxelCoord | null | undefined;
  #staleAimFrames = 0;
  #altClickTravel = 0;
  #blockedPaintReported = false;
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
      view,
      camera,
      brush,
      selection,
      pointer,
      groundPlaneSize = 4096,
      maxDistance = kDefaultMaxDistance,
      skyRadius = kDefaultSkyRadius,
      color
    } = options;

    this.view = view;
    this.#camera = camera;
    this.#brush = brush;
    this.#selection = selection;
    this.#pointerCapture = pointer;
    this.#onFocusRequest = options.onFocusRequest;
    this.#onPaintBlocked = options.onPaintBlocked;
    this.#aimer = new BrushAimResolver({
      camera,
      solid: view.root,
      groundPlaneSize,
      maxDistance,
      skyRadius
    });
    this.#preview = new BrushPreview({
      actor,
      camera,
      ghost: {
        blockRegistry: view.document.blocks,
        sources: options.sources
      },
      ...color === undefined ? {} : { color },
      onCursorChange: options.onCursorChange
    });
    const markDirty = () => {
      this.#preview.markDirty();
      actor.world.invalidate();
    };
    const markAimStale = () => {
      this.#staleAimFrames = kStaleAimFrames;
    };
    view.document.on("command", markAimStale);
    this.#unsubscribers = [
      () => view.document.off("command", markAimStale),
      actor.world.keepAlive(() => this.#staleAimFrames > 0),
      brush.subscribe("change", markDirty),
      brush.subscribe("blockChange", markDirty),
      selection.subscribe("change", () => {
        this.#blockedPaintReported = false;
      })
    ];
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
    this.actor.world.invalidate();
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
    const isCtrl = InputCombination.Control.evaluate(input);
    const isAlt = InputCombination.Alt.evaluate(input);

    if (
      this.#brush.suspended ||
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

    if (this.#selection.voxelLayer === null) {
      this.#endStroke();
      this.#preview.hide();
      if (
        input.mouse.wasJustPressed("left") ||
        input.mouse.wasJustPressed("right")
      ) {
        this.#reportBlockedPaint();
      }

      return;
    }

    this.#updateStroke();
    this.#updatePreview();
  }

  #reportBlockedPaint(): void {
    if (this.#blockedPaintReported) {
      return;
    }

    this.#blockedPaintReported = true;
    this.#onPaintBlocked();
  }

  #updateStroke(): void {
    const { input } = this.actor.world;

    if (this.#pointerCapture.captured) {
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
    const aim = this.#resolveAim();
    if (aim === null) {
      return;
    }

    const blockId = this.#pickedPart(aim)?.blockId ?? pickBlockAt(
      this.view,
      new BrushFootprint({
        ...this.#shape(),
        position: aim.remove,
        anchor: aim.anchors.remove
      })
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
    const paint = mode === "remove" ? undefined : this.#paint();
    const stroke = new BrushStroke({
      mode,
      layerName,
      paint,
      axis,
      pattern,
      origin: aim[side],
      anchor: aim.anchors[side],
      aimedPart: mode === "place" ? null : this.#aimedHalf(aim)?.aimed
    });

    this.#stroke = stroke;
    this.view.document.history.begin();
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
      ...brushOrientationOf(
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
    this.view.document.history.commit();
  }

  #apply(
    stroke: BrushStroke,
    centers: Iterable<VoxelCoord>
  ): void {
    if (applyBrushStroke(
      this.view,
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
    this.#onFocusRequest({
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
    const aim = this.#aimer.resolve(
      input.mouse.viewportPositionTo(this.#pointer)
    );
    this.#frameAim = aim !== null && this.#mergesAt(aim.remove) ?
      {
        ...aim,
        place: aim.remove,
        anchors: {
          ...aim.anchors,
          place: aim.anchors.remove
        }
      } :
      aim;

    return this.#frameAim;
  }

  #pickedPart(
    aim: BrushAim
  ): VoxelPart | null {
    const owner = this.view.document.world.getVoxelWithLayerAt(aim.remove);
    if (owner === undefined || aim.probe === null) {
      return null;
    }

    return this.view.partAt(owner.layer.name, aim.remove, aim.probe);
  }

  #aimedHalf(
    aim: BrushAim | null
  ): AimedHalf | null {
    const layerName = this.#selection.voxelLayer;
    if (
      aim === null ||
      aim.probe === null ||
      layerName === null ||
      this.#brush.size !== 1
    ) {
      return null;
    }

    const entry = this.view.document.world
      .getLayer(layerName)
      ?.getVoxelAt(aim.remove);
    const part = entry?.partner === undefined ?
      null :
      this.view.partAt(layerName, aim.remove, aim.probe);

    return entry === undefined || part === null ?
      null :
      AimedHalf.of(entry, part);
  }

  #removalTarget(): GhostTarget | null {
    if (this.#stroke !== null || this.#brush.mode === "replace") {
      return null;
    }

    const aim = this.#resolveAim();
    const half = this.#aimedHalf(aim);

    return aim === null || half === null ?
      null :
      partGhostOf(aim.remove, half.aimed);
  }

  #replacementGhost(): GhostTarget | null {
    if (this.#stroke !== null || this.#brush.mode !== "replace") {
      return null;
    }

    const aim = this.#resolveAim();
    const replacement = this.#aimedHalf(aim)?.replacementFor(
      this.#paint(),
      this.view.complements
    );

    return aim === null || !replacement ?
      null :
      partGhostOf(aim.remove, replacement);
  }

  #mergesAt(
    position: VoxelCoord
  ): boolean {
    const layerName = this.#selection.voxelLayer;

    return layerName !== null &&
      this.#brush.mode !== "replace" &&
      canMergePaint(this.view, layerName, position, this.#paint());
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
    if (this.view.pendingRebuilds > 0) {
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
    if (this.#pointerCapture.captured) {
      this.#preview.hide();

      return;
    }

    this.#preview.update(
      this.actor.world.input.mouse.isMoving(),
      this.#shape(),
      () => this.#previewTarget(),
      () => this.#ghostTarget(),
      () => this.#removalTarget()
    );
  }

  #ghostTarget(): GhostTarget | null {
    const layerName = this.#selection.voxelLayer;
    if (layerName === null || !this.#brush.ghost) {
      return null;
    }

    const replacement = this.#replacementGhost();
    if (replacement !== null) {
      return replacement;
    }

    const stroke = this.#stroke;
    const layer = this.view.document.world.getLayer(layerName);

    return ghostTargetOf({
      size: this.#brush.size,
      mode: this.#brush.mode,
      aim: stroke === null ? this.#resolveAim() : null,
      stroke: stroke === null ? null : {
        paint: stroke.paint,
        center: this.#previewCenter()
      },
      paint: this.#paint(),
      occupied: (position) => layer?.getVoxelAt(position) !== undefined &&
        !this.#mergesAt(position)
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
