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
import type { OpenStep } from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  BlockSelection,
  PointerCapture,
  SelectionStore
} from "../../state/index.ts";
import type { BrushStore } from "./BrushStore.ts";
import {
  BrushFootprint,
  type BrushShape
} from "./model/BrushFootprint.ts";
import { resolveBrushOrientation } from "./model/brushOrientation.ts";
import { AimedHalf } from "./model/AimedHalf.ts";
import {
  BrushStroke,
  canMergePaint,
  type StrokeMode,
  type StrokeTarget,
  type VoxelPaint
} from "./model/BrushStroke.ts";
import {
  resolveGhostTarget,
  createPartGhost,
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
import {
  MAP_HISTORY_SCOPE,
  type MapSteps
} from "../../shared/mapHistory.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultSkyRadius = 24;
const kStaleAimFrames = 2;
const kStrokeLabels: Readonly<Record<StrokeMode, string>> = {
  place: "Paint",
  replace: "Replace",
  remove: "Erase"
};

export interface LocalBrushOptions {
  view: VoxelView;
  sources: BlockRenderSources;
  camera: THREE.PerspectiveCamera;
  brush: BrushStore;
  block: BlockSelection;
  selection: SelectionStore;
  pointer: PointerCapture;
  history: MapSteps;
  groundPlaneSize?: number;
  maxDistance?: number;
  skyRadius?: number;
  color?: THREE.ColorRepresentation;
  onCursorChange: (cursor: BrushFootprint | null) => void;
  onPaintBlocked: () => void;
}

export class LocalBrush extends ActorComponent {
  readonly view: VoxelView;

  #camera: THREE.PerspectiveCamera;
  #brush: BrushStore;
  #block: BlockSelection;
  #selection: SelectionStore;
  #pointerCapture: PointerCapture;
  #history: MapSteps;
  #step: OpenStep | null = null;
  #onPaintBlocked: () => void;
  #aimer: BrushAimResolver;
  #preview: BrushPreview;
  #pointer = new THREE.Vector2();
  #stroke: BrushStroke | null = null;
  #frameAim: BrushAim | null | undefined;
  #frameCenter: VoxelCoord | null | undefined;
  #staleAimFrames = 0;
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
      block,
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
    this.#block = block;
    this.#selection = selection;
    this.#pointerCapture = pointer;
    this.#history = options.history;
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
      block.subscribe("change", markDirty),
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

    if (
      this.#brush.suspended ||
      !input.mouse.hovering ||
      this.#selection.isObjectContext ||
      input.mouse.isDown("middle") ||
      InputCombination.Alt.evaluate(input)
    ) {
      this.#endStroke();
      this.#preview.hide();

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

    const target = this.#strokeTarget(stroke);
    if (target === null) {
      return;
    }

    const { center, paints } = target;
    this.#frameCenter = center;
    if (!paints || !stroke.trails(center)) {
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
      this.#block.id = blockId;
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
      aimed: aim.remove,
      anchor: aim.anchors[side],
      aimedPart: mode === "place" ? null : this.#aimedHalf(aim)?.aimed
    });

    this.#stroke = stroke;
    this.#step = this.#history.open(MAP_HISTORY_SCOPE, kStrokeLabels[mode]);
    this.#frameCenter = stroke.origin;
    this.#apply(stroke, stroke.advance(stroke.origin));
  }

  #paint(): VoxelPaint {
    return {
      blockId: this.#block.id,
      ...resolveBrushOrientation(
        this.#camera,
        this.#brush.rotationMode,
        this.#brush.flipY,
        this.view.document.blocks.get(this.#block.id)?.shapeId
      )
    };
  }

  #endStroke(): void {
    if (this.#stroke === null) {
      return;
    }

    this.#stroke = null;
    this.#step?.commit();
    this.#step = null;
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

    return this.view.pickVoxelPart(owner.layer.name, aim.remove, aim.probe);
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
      this.view.pickVoxelPart(layerName, aim.remove, aim.probe);

    return entry === undefined || part === null ?
      null :
      AimedHalf.select(entry, part);
  }

  #removalTarget(): GhostTarget | null {
    if (this.#stroke !== null || this.#brush.mode === "replace") {
      return null;
    }

    const aim = this.#resolveAim();
    const half = this.#aimedHalf(aim);

    return aim === null || half === null ?
      null :
      createPartGhost(aim.remove, half.aimed);
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
      createPartGhost(aim.remove, replacement);
  }

  #mergesAt(
    position: VoxelCoord
  ): boolean {
    const layerName = this.#selection.voxelLayer;

    return layerName !== null &&
      this.#brush.mode !== "replace" &&
      canMergePaint(this.view, layerName, position, this.#paint());
  }

  #strokeTarget(
    stroke: BrushStroke
  ): StrokeTarget | null {
    const aim = this.#resolveAim();
    const pointer = this.actor.world.input.mouse.viewportPositionTo(
      this.#pointer
    );
    const revisited = this.#aimer.firstCellAlong(
      pointer,
      (cell) => stroke.claims(cell)
    );
    if (revisited !== null) {
      return stroke.revisit(revisited);
    }
    if (aim !== null && aim.face !== null) {
      return stroke.follow(aim.remove);
    }

    const center = this.#aimer.aimAtPlane(pointer, stroke.plane);

    return center === null ?
      null :
      {
        center,
        paints: true
      };
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

    return resolveGhostTarget({
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

    this.#frameCenter = this.#strokeTarget(stroke)?.center ?? null;

    return this.#frameCenter;
  }
}

function strokeButton(
  mode: StrokeMode
): "left" | "right" {
  return mode === "remove" ? "right" : "left";
}
