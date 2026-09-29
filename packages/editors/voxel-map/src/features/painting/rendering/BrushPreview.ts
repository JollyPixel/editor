// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { BrushMesh } from "./BrushMesh.ts";
import {
  GhostBlock,
  type GhostBlockOptions
} from "./GhostBlock.ts";
import * as cursor from "../model/brushCursor.ts";
import type { BrushCursor } from "../model/brushCursor.ts";
import type { BrushShape } from "../model/brushFootprint.ts";
import type { GhostTarget } from "../model/ghostTarget.ts";

export type BrushTarget = Pick<
  BrushCursor,
  "position" | "face" | "anchor"
>;

export interface BrushPreviewOptions {
  actor: Actor;
  camera: THREE.PerspectiveCamera;
  ghost: GhostBlockOptions;
  color?: THREE.ColorRepresentation;
  onCursorChange: (cursor: BrushCursor | null) => void;
}

export class BrushPreview {
  #actor: Actor;
  #camera: THREE.PerspectiveCamera;
  #mesh: BrushMesh;
  #ghost: GhostBlock;
  #onCursorChange: (cursor: BrushCursor | null) => void;
  #cursor: BrushCursor | null = null;
  #dirty = true;
  #lastCameraMatrix = new THREE.Matrix4();

  constructor(
    options: BrushPreviewOptions
  ) {
    this.#actor = options.actor;
    this.#camera = options.camera;
    this.#onCursorChange = options.onCursorChange;
    this.#mesh = new BrushMesh(
      options.color === undefined ? {} : { color: options.color }
    );
    this.#ghost = new GhostBlock(options.ghost);
    this.#actor.addChildren(this.#mesh, this.#ghost);
  }

  markDirty(): void {
    this.#dirty = true;
  }

  hide(): void {
    this.#mesh.hide();
    this.#ghost.hide();
    this.#dirty = true;
    this.#setCursor(null);
  }

  update(
    mouseMoving: boolean,
    shape: BrushShape,
    resolveTarget: () => BrushTarget | null,
    resolveGhost: () => GhostTarget | null
  ): void {
    if (!this.#consumeRefresh(mouseMoving)) {
      return;
    }

    const target = resolveTarget();
    if (target === null) {
      this.#mesh.clearFootprint();
      this.#ghost.hide();
      this.#setCursor(null);

      return;
    }

    const next = {
      ...shape,
      ...target
    };
    const ghost = resolveGhost();
    const ghosted = ghost !== null && this.#ghost.draw(ghost);
    if (!ghosted) {
      this.#ghost.hide();
    }
    this.#mesh.shelled = !ghosted;
    this.#mesh.show();
    this.#mesh.draw(next);
    this.#setCursor(next);
  }

  destroy(): void {
    this.#actor.removeChildren(this.#mesh);
    this.#ghost.removeFromParent();
    this.#ghost.dispose();
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
