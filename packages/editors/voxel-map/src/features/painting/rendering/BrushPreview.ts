// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BrushStore } from "../../../app/state/index.ts";
import { BrushMesh } from "./BrushMesh.ts";
import type { BrushStyle } from "../model/BrushStyle.ts";
import * as cursor from "../model/brushCursor.ts";
import type { BrushCursor } from "../model/brushCursor.ts";

export interface BrushPreviewOptions {
  actor: Actor;
  camera: THREE.PerspectiveCamera;
  brush: BrushStore;
  color?: THREE.ColorRepresentation;
  onCursorChange: (cursor: BrushCursor | null) => void;
}

/** Owns local brush presentation and cursor-change publication. */
export class BrushPreview {
  #actor: Actor;
  #camera: THREE.PerspectiveCamera;
  #mesh: BrushMesh;
  #onCursorChange: (cursor: BrushCursor | null) => void;
  #cursor: BrushCursor | null = null;
  #dirty = true;
  #lastCameraMatrix = new THREE.Matrix4();
  #unsubscribeStyle: () => void;

  constructor(
    options: BrushPreviewOptions
  ) {
    this.#actor = options.actor;
    this.#camera = options.camera;
    this.#onCursorChange = options.onCursorChange;
    this.#mesh = new BrushMesh({
      ...options.color === undefined ? {} : { color: options.color },
      style: options.brush.style
    });
    this.#actor.addChildren(this.#mesh);
    this.#unsubscribeStyle = options.brush.watch(
      "styleChange",
      (style: BrushStyle) => {
        this.#mesh.style = style;
      }
    );
  }

  markDirty(): void {
    this.#dirty = true;
  }

  hide(): void {
    this.#mesh.hide();
    this.#dirty = true;
    this.#setCursor(null);
  }

  update(
    mouseMoving: boolean,
    size: number,
    resolveCenter: () => VoxelCoord | null
  ): void {
    if (!this.#consumeRefresh(mouseMoving)) {
      return;
    }

    const center = resolveCenter();
    if (center === null) {
      this.#mesh.clearFootprint();
      this.#setCursor(null);

      return;
    }

    const next = { position: center, size };
    this.#mesh.show();
    this.#mesh.draw(next);
    this.#setCursor(next);
  }

  destroy(): void {
    this.#unsubscribeStyle();
    this.#actor.removeChildren(this.#mesh);
  }

  #consumeRefresh(
    mouseMoving: boolean
  ): boolean {
    const cameraMoved = !this.#lastCameraMatrix.equals(
      this.#camera.matrixWorld
    );
    if (!this.#dirty && !cameraMoved && !mouseMoving) {
      return false;
    }

    this.#lastCameraMatrix.copy(this.#camera.matrixWorld);
    this.#dirty = false;

    return true;
  }

  #setCursor(
    next: BrushCursor | null
  ): void {
    if (cursor.equals(next, this.#cursor)) {
      return;
    }

    this.#cursor = next;
    this.#onCursorChange(next);
  }
}
