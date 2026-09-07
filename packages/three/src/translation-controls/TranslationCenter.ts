// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createTranslationOutline } from "./outline.ts";
import type { TranslationOutlineOptions } from "./types.ts";

export interface TranslationCenterOptions {
  color: THREE.ColorRepresentation;
  radius: number;
  radialSegments: number;
  outline: false | Required<TranslationOutlineOptions>;
  depthTest: boolean;
  renderOrder: number;
}

/**
 * Optional visual-only marker for the gizmo origin.
 */
export class TranslationCenter extends THREE.Object3D {
  override readonly type = "TranslationCenter";

  #visual: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  #outline: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
  #disposed = false;

  constructor(
    options: TranslationCenterOptions
  ) {
    super();

    const {
      color,
      radius,
      radialSegments,
      outline,
      depthTest,
      renderOrder
    } = options;
    const geometry = new THREE.SphereGeometry(
      radius,
      radialSegments,
      Math.max(4, Math.floor(radialSegments / 2))
    );
    this.name = "translation-center";
    this.#visual = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthTest,
        depthWrite: false,
        fog: false,
        toneMapped: false
      })
    );
    this.#visual.name = "translation-center-visual";
    this.#visual.renderOrder = renderOrder + 1;
    this.#visual.frustumCulled = false;

    this.#outline = outline === false
      ? null
      : createTranslationOutline(
        geometry,
        outline,
        depthTest,
        renderOrder
      );
    if (this.#outline) {
      this.#outline.name = "translation-center-outline";
      this.add(this.#outline);
    }
    this.add(this.#visual);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#visual.geometry.dispose();
    this.#visual.material.dispose();
    this.#outline?.geometry.dispose();
    this.#outline?.material.dispose();
    this.clear();
  }
}
