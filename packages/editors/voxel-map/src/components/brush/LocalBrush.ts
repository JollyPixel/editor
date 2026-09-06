// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  voxelCellOf,
  voxelPositionOf,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../../EditorState.ts";
import {
  castViewRay,
  type ViewRayHit
} from "../../shared/viewFocus.ts";
import * as cursor from "./cursor.ts";
import type { BrushCursor } from "./cursor.ts";
import {
  resolveFlipY,
  resolveRotation
} from "./orientation.ts";
import { BrushMesh } from "./BrushMesh.ts";
import type { BrushStyle } from "./BrushStyle.ts";
import {
  BrushStroke,
  type StrokeMode
} from "./stroke.ts";

// CONSTANTS
const kDefaultMaxDistance = 32;
const kDefaultStampInterval = 70;
const kDefaultStampCells = 2;
const kPlane = new THREE.Plane();
const kPlanePoint = new THREE.Vector3();
const kUp = new THREE.Vector3(0, 1, 0);

interface BrushAim {
  place: VoxelCoord;
  remove: VoxelCoord;
}

export interface LocalBrushOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
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
 * The brush this user paints with: it owns the pointer input, the aim ray and
 * the voxel edits, and publishes the aimed cursor for `PeerBrushes` to share.
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

  readonly vr: VoxelRenderer;

  #camera: THREE.PerspectiveCamera;
  #cursor: BrushCursor | null = null;
  #raycaster = new THREE.Raycaster();
  #groundPlaneSize: number;
  #maxDistance: number;
  #mesh: BrushMesh;
  #pointer = new THREE.Vector2();
  #previewDirty = true;
  #lastCameraMatrix = new THREE.Matrix4();
  #stroke: BrushStroke | null = null;
  #frameAim: BrushAim | null | undefined;
  #frameCenter: VoxelCoord | null | undefined;
  #stampInterval: number;
  #stampCells: number;
  #sinceStamp = 0;
  #unsubscribeStyle: () => void;

  constructor(
    actor: Actor,
    options: LocalBrushOptions
  ) {
    super({
      actor,
      typeName: "LocalBrush"
    });
    const {
      vr,
      camera,
      groundPlaneSize = 4096,
      maxDistance = kDefaultMaxDistance,
      color,
      stampInterval = kDefaultStampInterval,
      stampCells = kDefaultStampCells
    } = options;

    this.vr = vr;
    this.#camera = camera;
    this.#groundPlaneSize = groundPlaneSize;
    this.#maxDistance = maxDistance;
    this.#stampInterval = stampInterval;
    this.#stampCells = stampCells;

    this.#mesh = new BrushMesh({
      ...color === undefined ? {} : { color },
      style: editorState.brushStyle
    });
    this.actor.addChildren(this.#mesh);
    this.#unsubscribeStyle = editorState.on(
      "brushStyleChange",
      (style: BrushStyle) => {
        this.#mesh.style = style;
      }
    );
  }

  get maxDistance(): number {
    return this.#maxDistance;
  }

  set maxDistance(value: number) {
    if (value === this.#maxDistance) {
      return;
    }

    this.#maxDistance = value;
    this.#previewDirty = true;
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
    this.#unsubscribeStyle();
    this.actor.removeChildren(this.#mesh);
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
      editorState.isObjectContext ||
      input.mouse.isDown("middle")
    ) {
      this.#endStroke();
      this.#hidePreview();

      return;
    }

    if (isCtrl) {
      this.#endStroke();
      if (input.mouse.isDown("scrollUp")) {
        editorState.setBrushSize(1);
        this.#previewDirty = true;
      }
      if (input.mouse.isDown("scrollDown")) {
        editorState.setBrushSize(-1);
        this.#previewDirty = true;
      }

      this.#updatePreview();

      return;
    }

    this.#updateStroke();
    this.#updatePreview();
  }

  #updateStroke(): void {
    const { input } = this.actor.world;

    if (editorState.isGizmoDragging) {
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
    this.#apply(
      stroke,
      stroke.advance(center, this.#stampCells)
    );
  }

  #beginStroke(
    mode: StrokeMode
  ): void {
    const layerName = editorState.selectedVoxelLayer;
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
      blockId: editorState.selectedBlockId,
      rotation: resolveRotation(
        this.#camera,
        editorState.rotationMode
      ),
      flipY: resolveFlipY(
        this.#camera,
        editorState.rotationMode,
        editorState.flipY
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
    const size = editorState.brushSize;
    const cells: VoxelCoord[] = [];

    for (const position of centers) {
      cells.push(
        ...stroke.claim(cursor.cellsOf({ position, size }))
      );
    }
    if (cells.length === 0) {
      return;
    }

    const { world } = this.vr.engine;
    if (stroke.paint) {
      const { blockId, rotation, flipY } = stroke.paint;

      world.setVoxelBulk(
        stroke.layerName,
        cells.map((position) => {
          return {
            position,
            blockId,
            rotation,
            flipY
          };
        })
      );
    }
    else {
      const layer = world.getLayer(stroke.layerName);
      const entries = cells
        .filter((position) => layer?.getVoxelAt(position) !== undefined)
        .map((position) => {
          return { position };
        });
      if (entries.length === 0) {
        return;
      }

      world.removeVoxelBulk(stroke.layerName, entries);
    }

    this.vr.engine.flush();
    this.#previewDirty = true;
  }

  #castRay(): ViewRayHit | null {
    const { input } = this.actor.world;

    const hit = castViewRay(this.#camera, this.vr.engine.root, {
      pointer: input.mouse.viewportPositionTo(this.#pointer),
      groundPlaneSize: this.#groundPlaneSize,
      raycaster: this.#raycaster
    });

    if (hit === null || hit.distance > this.#maxDistance) {
      return null;
    }

    return hit;
  }

  #resolveAim(): BrushAim | null {
    if (this.#frameAim !== undefined) {
      return this.#frameAim;
    }

    const hit = this.#castRay();
    this.#frameAim = hit === null ? null : {
      place: voxelPositionOf(hit.point, hit.normal, "front"),
      // The ground plane has no voxel behind it, so the cell resting on it
      // is the one both outlined and removed.
      remove: voxelPositionOf(
        hit.point,
        hit.normal,
        hit.ground ? "front" : "back"
      )
    };

    return this.#frameAim;
  }

  #castOnPlane(
    height: number
  ): VoxelCoord | null {
    const { input } = this.actor.world;

    this.#raycaster.setFromCamera(
      input.mouse.viewportPositionTo(this.#pointer),
      this.#camera
    );
    // The plane cuts through the middle of the cells it locks onto.
    kPlane.set(kUp, -(height + 0.5));

    const point = this.#raycaster.ray.intersectPlane(kPlane, kPlanePoint);
    if (
      point === null ||
      point.distanceTo(this.#raycaster.ray.origin) > this.#maxDistance
    ) {
      return null;
    }

    const cell = voxelCellOf(point);

    return {
      x: cell.x,
      y: height,
      z: cell.z
    };
  }

  #cursorAt(
    center: VoxelCoord
  ): BrushCursor {
    return {
      position: center,
      size: editorState.brushSize
    };
  }

  #setCursor(
    next: BrushCursor | null
  ): void {
    if (cursor.equals(next, this.#cursor)) {
      return;
    }

    this.#cursor = next;
    this.onCursorChange?.(next);
  }

  #hidePreview(): void {
    this.#mesh.hide();
    this.#previewDirty = true;
    this.#setCursor(null);
  }

  #consumePreviewRefresh(): boolean {
    const { input } = this.actor.world;
    const cameraMoved = !this.#lastCameraMatrix.equals(
      this.#camera.matrixWorld
    );

    if (!this.#previewDirty && !cameraMoved && !input.mouse.isMoving()) {
      return false;
    }

    this.#lastCameraMatrix.copy(this.#camera.matrixWorld);
    this.#previewDirty = false;

    return true;
  }

  #updatePreview(): void {
    if (editorState.isGizmoDragging) {
      this.#hidePreview();

      return;
    }
    if (!this.#consumePreviewRefresh()) {
      return;
    }

    const center = this.#previewCenter();
    if (center === null) {
      this.#mesh.clearFootprint();
      this.#setCursor(null);

      return;
    }

    const next = this.#cursorAt(center);
    this.#mesh.show();
    this.#mesh.draw(next);
    this.#setCursor(next);
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
