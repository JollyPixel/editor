// Import Third-party Dependencies
import * as THREE from "three";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { CubeBehavior } from "./components/Cube.ts";
import type { CubeFactory } from "./components/CubeFactory.ts";

export interface CubeGalleryOptions {
  cubeFactory: CubeFactory;
  canvasManager: PixelArtCanvas;
}

export interface CubeGalleryAppearance {
  borderColor: THREE.ColorRepresentation;
}

// Spacing for a centered near-square grid; cubes ease to new positions on relayout.
const kGridSpacing = 2.4;

/**
 * Mirrors UV regions as 3D cubes: one cube per region, collapsed or per-face.
 */
export class CubeGallery {
  #cubeFactory: CubeFactory;
  #canvasManager: PixelArtCanvas;
  #cubes = new Map<string, CubeBehavior>();

  #appearance: CubeGalleryAppearance = {
    borderColor: "#101820"
  };
  #rotating = true;

  constructor(
    options: CubeGalleryOptions
  ) {
    this.#cubeFactory = options.cubeFactory;
    this.#canvasManager = options.canvasManager;

    const { uv } = this.#canvasManager;

    uv.on("region-created", ({ region }) => {
      const cube = this.#cubeFactory.create(
        region,
        this.#canvasManager.textureSize
      );
      const referenceCube = this.#cubes.values().next().value;
      if (referenceCube) {
        cube.setRotation(referenceCube.actor.object3D.rotation);
      }
      this.#cubes.set(region.id, cube);
      this.#relayout();
      cube.setBorderColor(this.#appearance.borderColor);
      cube.setRotating(this.#rotating);
    });

    uv.on("region-deleted", ({ region }) => {
      const cube = this.#cubes.get(region.id);
      if (cube) {
        this.#cubeFactory.destroy(cube);
        this.#cubes.delete(region.id);
      }
      this.#relayout();
    });

    uv.on("region-moved", ({ region, face }) => {
      this.#cubes.get(region.id)?.applyFace(
        face,
        region.rectFor(face ?? "front"),
        this.#canvasManager.textureSize
      );
    });

    uv.on("region-dragging", ({ id, face, rect }) => {
      this.#cubes.get(id)?.applyFace(
        face,
        rect,
        this.#canvasManager.textureSize
      );
    });

    // Collapse/uncollapse rewrites every face; remap the whole cube.
    uv.on("region-state-changed", ({ region }) => {
      this.#cubes.get(region.id)?.applyRegion(
        region,
        this.#canvasManager.textureSize
      );
    });

    uv.on("selection-changed", ({ selectedRegionId }) => {
      for (const [regionId, cube] of this.#cubes) {
        cube.setSelected(regionId === selectedRegionId);
      }
    });
  }

  /**
   * Cube meshes for raycasting.
   */
  get meshes(): THREE.Object3D[] {
    return [...this.#cubes.values()].map((cube) => cube.mesh);
  }

  /**
   * Remaps every cube's UV to the current texture size.
   * Must be called after texture replace or resize (no event covers this).
   */
  refreshTextureSize(): void {
    const { textureSize } = this.#canvasManager;
    for (const region of this.#canvasManager.uv.regions) {
      this.#cubes
        .get(region.id)
        ?.applyRegion(region, textureSize);
    }
  }

  setAppearance(
    appearance: CubeGalleryAppearance
  ): void {
    this.#appearance = appearance;
    for (const cube of this.#cubes.values()) {
      cube.setBorderColor(appearance.borderColor);
    }
  }

  setRotating(
    rotating: boolean
  ): void {
    this.#rotating = rotating;
    for (const cube of this.#cubes.values()) {
      cube.setRotating(rotating);
    }
  }

  #relayout(): void {
    const entries = [...this.#cubes.values()];
    if (entries.length === 0) {
      return;
    }

    const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
    const rows = Math.ceil(entries.length / columns);
    const centerCol = (columns - 1) / 2;
    const centerRow = (rows - 1) / 2;

    entries.forEach((cube, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      cube.setTargetPosition(new THREE.Vector3(
        (col - centerCol) * kGridSpacing,
        (centerRow - row) * kGridSpacing,
        0
      ));
    });
  }
}
