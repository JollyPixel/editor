// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  VoxelRotation,
  voxelPositionOf,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import {
  castViewRay,
  type ViewRayHit
} from "../shared/viewFocus.ts";
import { VoxelBrushPreview } from "./VoxelBrushPreview.ts";

type VoxelRotationType = typeof VoxelRotation[
  keyof typeof VoxelRotation
];

export interface VoxelBrushOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
  /**
   * Side of the square ground plane the brush falls back to when the pointer
   * misses every voxel.
   * @default 4096
   */
  groundPlaneSize?: number;
}

export class VoxelBrush extends ActorComponent {
  readonly vr: VoxelRenderer;

  #camera: THREE.PerspectiveCamera;
  #raycaster = new THREE.Raycaster();
  #groundPlaneSize: number;
  #preview: VoxelBrushPreview;
  #pointer = new THREE.Vector2();
  #previewDirty = true;
  #lastCameraMatrix = new THREE.Matrix4();

  constructor(
    actor: Actor,
    options: VoxelBrushOptions
  ) {
    super({
      actor,
      typeName: "VoxelBrush"
    });
    const {
      vr,
      camera,
      groundPlaneSize = 4096
    } = options;

    this.vr = vr;
    this.#camera = camera;
    this.#groundPlaneSize = groundPlaneSize;

    this.#preview = this.actor.addComponentAndGet(VoxelBrushPreview);
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

    return castViewRay(this.#camera, this.vr.engine.root, {
      pointer: input.mouse.viewportPositionTo(this.#pointer),
      groundPlaneSize: this.#groundPlaneSize,
      raycaster: this.#raycaster
    });
  }

  #getBrushPositions(
    center: VoxelCoord
  ): THREE.Vector3[] {
    const size = editorState.brushSize;
    const half = Math.floor(size / 2);
    const positions: THREE.Vector3[] = [];

    for (let dx = 0; dx < size; dx++) {
      for (let dz = 0; dz < size; dz++) {
        positions.push(new THREE.Vector3(
          center.x - half + dx,
          center.y,
          center.z - half + dz
        ));
      }
    }

    return positions;
  }

  #resolveFlipY(): boolean {
    if (editorState.flipY) {
      return true;
    }

    if (editorState.rotationMode === "auto") {
      const dir = new THREE.Vector3();
      this.#camera.getWorldDirection(dir);

      return dir.y > 0;
    }

    return false;
  }

  #resolveRotation(): VoxelRotationType {
    const mode = editorState.rotationMode;
    if (mode !== "auto") {
      return mode;
    }

    const dir = new THREE.Vector3();
    this.#camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const absX = Math.abs(dir.x);
    const absZ = Math.abs(dir.z);

    if (absZ >= absX) {
      return dir.z > 0 ?
        VoxelRotation.None :
        VoxelRotation.Deg180;
    }

    return dir.x > 0 ?
      VoxelRotation.CCW90 :
      VoxelRotation.CW90;
  }

  #placeVoxels(): void {
    const hit = this.#castRay();
    if (!hit) {
      return;
    }

    const center = voxelPositionOf(hit.point, hit.normal, "front");
    const rotation = this.#resolveRotation();
    const flipY = this.#resolveFlipY();
    const layerName = editorState.selectedVoxelLayer!;

    for (const pos of this.#getBrushPositions(center)) {
      this.vr.engine.setVoxel(layerName, {
        position: pos,
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

    for (const pos of this.#getBrushPositions(center)) {
      this.vr.engine.removeVoxel(layerName, { position: pos });
    }
    this.vr.engine.flush();
    this.#previewDirty = true;
  }

  #hidePreview(): void {
    this.#preview.hide();
    this.#previewDirty = true;
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
    if (hit) {
      const center = voxelPositionOf(
        hit.point,
        hit.normal,
        hit.ground ? "front" : "back"
      );

      this.#preview.updateFromPositions(
        this.#getBrushPositions(center),
        hit.ground ? null : hit.normal
      );
    }
    else {
      this.#preview.count = 0;
    }
  }
}
