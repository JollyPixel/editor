// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { BrushMesh } from "./BrushMesh.ts";
import {
  GhostBlock,
  type GhostBlockOptions
} from "./GhostBlock.ts";
import {
  BrushFootprint,
  type BrushFootprintOptions,
  type BrushShape
} from "../model/BrushFootprint.ts";
import type { GhostTarget } from "../model/ghostTarget.ts";

// CONSTANTS
const kRemovalTint = 0xff5c5c;

export type BrushTarget = Pick<
  BrushFootprintOptions,
  "position" | "face" | "anchor"
>;

export interface BrushPreviewOptions {
  actor: Actor;
  camera: THREE.PerspectiveCamera;
  ghost: GhostBlockOptions;
  color?: THREE.ColorRepresentation;
  onCursorChange: (cursor: BrushFootprint | null) => void;
}

export class BrushPreview {
  #actor: Actor;
  #camera: THREE.PerspectiveCamera;
  #mesh: BrushMesh;
  #ghost: GhostBlock;
  #removal: GhostBlock;
  #onCursorChange: (cursor: BrushFootprint | null) => void;
  #cursor: BrushFootprint | null = null;
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
    this.#removal = new GhostBlock({
      ...options.ghost,
      tint: kRemovalTint
    });
    this.#removal.name = "removal-ghost";
    this.#actor.addChildren(this.#mesh, this.#ghost, this.#removal);
  }

  markDirty(): void {
    this.#dirty = true;
  }

  hide(): void {
    this.#mesh.hide();
    this.#ghost.hide();
    this.#removal.hide();
    this.#dirty = true;
    this.#setCursor(null);
  }

  update(
    mouseMoving: boolean,
    shape: BrushShape,
    resolveTarget: () => BrushTarget | null,
    resolveGhost: () => GhostTarget | null,
    resolveRemoval: () => GhostTarget | null
  ): void {
    if (!this.#consumeRefresh(mouseMoving)) {
      return;
    }

    const target = resolveTarget();
    if (target === null) {
      this.#mesh.clearFootprint();
      this.#ghost.hide();
      this.#removal.hide();
      this.#setCursor(null);

      return;
    }

    const next = new BrushFootprint({
      ...shape,
      ...target
    });
    const ghosted = drawOrHide(this.#ghost, resolveGhost());
    if (drawOrHide(this.#removal, resolveRemoval())) {
      this.#mesh.hide();
    }
    else {
      this.#mesh.shelled = !ghosted;
      this.#mesh.show();
      this.#mesh.draw(next);
    }
    this.#setCursor(next);
  }

  destroy(): void {
    this.#actor.removeChildren(this.#mesh);
    for (const ghost of [this.#ghost, this.#removal]) {
      ghost.removeFromParent();
      ghost.dispose();
    }
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
    next: BrushFootprint | null
  ): void {
    if (next === this.#cursor || next?.equals(this.#cursor) === true) {
      return;
    }

    this.#cursor = next;
    this.#onCursorChange(next);
  }
}

function drawOrHide(
  ghost: GhostBlock,
  target: GhostTarget | null
): boolean {
  if (target !== null && ghost.draw(target)) {
    return true;
  }

  ghost.hide();

  return false;
}
