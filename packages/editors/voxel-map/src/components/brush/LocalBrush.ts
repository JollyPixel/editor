// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
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

// CONSTANTS
const kDefaultMaxDistance = 32;

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
}

/**
 * The brush this user paints with: it owns the pointer input, the aim ray and
 * the voxel edits, and publishes the aimed cursor for `PeerBrushes` to share.
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
      color
    } = options;

    this.vr = vr;
    this.#camera = camera;
    this.#groundPlaneSize = groundPlaneSize;
    this.#maxDistance = maxDistance;

    this.#mesh = new BrushMesh(
      color === undefined ? {} : { color }
    );
    this.actor.addChildren(this.#mesh);
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

  override destroy(): void {
    this.actor.removeChildren(this.#mesh);
    super.destroy();
  }

  update() {
    const { input } = this.actor.world;
    const isCtrl = input.keyboard.isDown("ControlLeft") || input.keyboard.isDown("ControlRight");

    if (editorState.isObjectContext) {
      this.#hidePreview();

      return;
    }

    if (input.mouse.isDown("middle")) {
      this.#hidePreview();

      return;
    }

    if (isCtrl) {
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

    if (!editorState.isGizmoDragging) {
      if (input.mouse.wasJustPressed("left")) {
        if (editorState.selectedVoxelLayer) {
          this.#placeVoxels();
        }
      }
      else if (input.mouse.wasJustPressed("right")) {
        if (editorState.selectedVoxelLayer) {
          this.#removeVoxels();
        }
      }
    }

    this.#updatePreview();
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

  #cellsAround(
    center: VoxelCoord
  ): VoxelCoord[] {
    return cursor.cellsOf({
      position: center,
      size: editorState.brushSize
    });
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

  #placeVoxels(): void {
    const hit = this.#castRay();
    if (!hit) {
      return;
    }

    const center = voxelPositionOf(hit.point, hit.normal, "front");
    const rotation = resolveRotation(
      this.#camera,
      editorState.rotationMode
    );
    const flipY = resolveFlipY(
      this.#camera,
      editorState.rotationMode,
      editorState.flipY
    );
    const layerName = editorState.selectedVoxelLayer!;

    for (const position of this.#cellsAround(center)) {
      this.vr.engine.world.setVoxel(layerName, {
        position,
        blockId: editorState.selectedBlockId,
        rotation,
        flipY
      });
    }
    this.vr.engine.flush();
    this.#previewDirty = true;
  }

  #removeVoxels(): void {
    const hit = this.#castRay();
    if (!hit) {
      return;
    }

    const center = voxelPositionOf(hit.point, hit.normal, "back");
    const layerName = editorState.selectedVoxelLayer!;

    for (const position of this.#cellsAround(center)) {
      this.vr.engine.world.removeVoxel(layerName, { position });
    }
    this.vr.engine.flush();
    this.#previewDirty = true;
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

    const hit = this.#castRay();
    if (!hit) {
      this.#mesh.clearCells();
      this.#setCursor(null);

      return;
    }

    const center = voxelPositionOf(
      hit.point,
      hit.normal,
      hit.ground ? "front" : "back"
    );

    this.#mesh.show();
    this.#mesh.drawCells(
      this.#cellsAround(center)
    );
    this.#setCursor({
      position: center,
      size: editorState.brushSize
    });
  }
}
