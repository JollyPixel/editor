// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  isHighlightOverlay,
  type HighlightOverlay
} from "./HighlightOverlay.ts";
import { HighlightMeshSilhouette } from "./HighlightMeshSilhouette.ts";
import {
  SILHOUETTE_LINEWIDTH,
  type HighlightSilhouetteOptions
} from "./HighlightSilhouette.ts";

export interface HighlightGroupSilhouetteOptions extends Omit<
  HighlightSilhouetteOptions,
  "target"
> {
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
    this.#collect();
  }

  get color(): THREE.Color {
    return this.#color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color.set(color);
    for (const silhouette of this.#outlines.values()) {
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
    for (const silhouette of this.#outlines.values()) {
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
    for (const silhouette of this.#outlines.values()) {
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
    for (const silhouette of this.#outlines.values()) {
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
    for (const silhouette of this.#outlines.values()) {
      silhouette.occludedOpacity = occludedOpacity;
    }
  }

  update(
    cameraWorldPosition: THREE.Vector3
  ): void {
    this.#collect();
    for (const silhouette of this.#outlines.values()) {
      silhouette.update(cameraWorldPosition);
    }
  }

  dispose(): void {
    for (const silhouette of this.#outlines.values()) {
      silhouette.dispose();
    }
    this.#outlines.clear();
  }

  #collect(): void {
    const meshes = visibleMeshes(this.target);
    for (const [mesh, silhouette] of this.#outlines) {
      if (!meshes.has(mesh)) {
        silhouette.dispose();
        this.#outlines.delete(mesh);
      }
    }

    for (const mesh of meshes) {
      if (!this.#outlines.has(mesh)) {
        this.#outlines.set(mesh, this.#outline(mesh));
      }
    }
  }

  #outline(
    mesh: THREE.Mesh
  ): HighlightMeshSilhouette {
    return new HighlightMeshSilhouette({
      ...this.#options,
      target: mesh,
      color: this.#color,
      opacity: this.#opacity,
      linewidth: this.#linewidth,
      xray: this.#xray,
      occludedOpacity: this.#occludedOpacity
    });
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
