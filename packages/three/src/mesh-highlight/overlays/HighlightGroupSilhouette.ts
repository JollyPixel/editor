// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  isHighlightOverlay,
  type HighlightOverlay
} from "./HighlightOverlay.ts";
import { HighlightMeshSilhouette } from "./HighlightMeshSilhouette.ts";
import { HighlightHullSilhouette } from "./HighlightHullSilhouette.ts";
import {
  SILHOUETTE_LINEWIDTH,
  type HighlightSilhouette,
  type SilhouetteAnchorOptions
} from "./HighlightSilhouette.ts";
import { GroupHull } from "./groupHull.ts";
import type { MeshContour } from "./meshContour.ts";

export interface HighlightGroupSilhouetteOptions extends SilhouetteAnchorOptions {
  /**
   * Object whose visible mesh descendants are outlined, itself included.
   */
  target: THREE.Object3D;
}

export class HighlightGroupSilhouette implements HighlightOverlay {
  readonly target: THREE.Object3D;

  #options: HighlightGroupSilhouetteOptions;
  #color: THREE.Color;
  #opacity: number;
  #linewidth: number;
  #xray: boolean;
  #occludedOpacity: number;
  #outlines = new Map<THREE.Mesh, HighlightMeshSilhouette>();
  #groupHull: GroupHull;
  #hull: HighlightHullSilhouette | null = null;

  constructor(
    options: HighlightGroupSilhouetteOptions
  ) {
    const {
      target,
      color = "#ffffff",
      opacity = 1,
      linewidth = SILHOUETTE_LINEWIDTH,
      xray = false,
      occludedOpacity = opacity
    } = options;

    this.target = target;
    this.#options = options;
    this.#color = new THREE.Color(color);
    this.#opacity = opacity;
    this.#linewidth = linewidth;
    this.#xray = xray;
    this.#occludedOpacity = occludedOpacity;
    this.#groupHull = new GroupHull(target);
    this.#collect();
  }

  get color(): THREE.Color {
    return this.#color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color.set(color);
    for (const silhouette of this.#silhouettes()) {
      silhouette.color = this.#color;
    }
  }

  get opacity(): number {
    return this.#opacity;
  }

  set opacity(
    opacity: number
  ) {
    this.#opacity = opacity;
    for (const silhouette of this.#silhouettes()) {
      silhouette.opacity = opacity;
    }
  }

  get linewidth(): number {
    return this.#linewidth;
  }

  set linewidth(
    linewidth: number
  ) {
    this.#linewidth = linewidth;
    for (const silhouette of this.#silhouettes()) {
      silhouette.linewidth = linewidth;
    }
  }

  get xray(): boolean {
    return this.#xray;
  }

  set xray(
    xray: boolean
  ) {
    this.#xray = xray;
    for (const silhouette of this.#silhouettes()) {
      silhouette.xray = xray;
    }
  }

  get occludedOpacity(): number {
    return this.#occludedOpacity;
  }

  set occludedOpacity(
    occludedOpacity: number
  ) {
    this.#occludedOpacity = occludedOpacity;
    for (const silhouette of this.#silhouettes()) {
      silhouette.occludedOpacity = occludedOpacity;
    }
  }

  update(
    cameraWorldPosition: THREE.Vector3
  ): void {
    this.#collect();
    for (const silhouette of this.#silhouettes()) {
      silhouette.update(cameraWorldPosition);
    }
  }

  dispose(): void {
    this.#dropHull();
    this.#dropOutlines();
  }

  * #silhouettes(): IterableIterator<HighlightSilhouette> {
    yield* this.#outlines.values();
    if (this.#hull !== null) {
      yield this.#hull;
    }
  }

  #collect(): void {
    const meshes = visibleMeshes(this.target);
    const contour = meshes.size > 1 ? this.#groupHull.measure(meshes) : null;
    if (contour === null) {
      this.#dropHull();
      this.#outlineEach(meshes);
    }
    else {
      this.#dropOutlines();
      this.#outlineHull(contour);
    }
  }

  #outlineEach(
    meshes: ReadonlySet<THREE.Mesh>
  ): void {
    for (const [mesh, silhouette] of this.#outlines) {
      if (!meshes.has(mesh)) {
        silhouette.dispose();
        this.#outlines.delete(mesh);
      }
    }
    for (const mesh of meshes) {
      if (!this.#outlines.has(mesh)) {
        this.#outlines.set(mesh, new HighlightMeshSilhouette({
          ...this.#silhouetteOptions(),
          target: mesh
        }));
      }
    }
  }

  #outlineHull(
    contour: MeshContour
  ): void {
    if (this.#hull === null) {
      this.#hull = new HighlightHullSilhouette({
        ...this.#silhouetteOptions(),
        contour
      });
    }
    else {
      this.#hull.reshape(contour);
    }
  }

  #dropOutlines(): void {
    for (const silhouette of this.#outlines.values()) {
      silhouette.dispose();
    }
    this.#outlines.clear();
  }

  #dropHull(): void {
    this.#hull?.dispose();
    this.#hull = null;
  }

  #silhouetteOptions(): HighlightGroupSilhouetteOptions {
    return {
      ...this.#options,
      color: this.#color,
      opacity: this.#opacity,
      linewidth: this.#linewidth,
      xray: this.#xray,
      occludedOpacity: this.#occludedOpacity
    };
  }
}

function visibleMeshes(
  root: THREE.Object3D
): Set<THREE.Mesh> {
  const meshes = new Set<THREE.Mesh>();
  const pending = [root];
  while (pending.length > 0) {
    const object = pending.pop()!;
    if (!object.visible || isHighlightOverlay(object)) {
      continue;
    }
    if (
      object instanceof THREE.Mesh &&
      !(object instanceof THREE.InstancedMesh)
    ) {
      meshes.add(object);
    }
    pending.push(...object.children);
  }

  return meshes;
}
