// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type CubeBehavior } from "./components/Cube.ts";
import { type CubeFactory } from "./components/CubeFactory.ts";
import { type PixelArtCanvas } from "../../src/index.ts";

export interface CubeGalleryOptions {
  cubeFactory: CubeFactory;
  canvasManager: PixelArtCanvas;
}

// Recomputes every cube's target position as a centered, near-square
// grid — re-run on every create/delete so the cluster (1 cube or many)
// always sits centered on the origin, not just column-centered against
// a fixed column count. CubeBehavior eases toward the new target itself
// (see setTargetPosition), so a reflow reads as a smooth glide.
const kGridSpacing = 2.4;

/**
 * Mirrors a PixelArtCanvas's UV regions as 3D test cubes — one cube per
 * region, so placement/move can be visually verified. Face assignment is
 * out of scope for this demo: a region's rect is applied uniformly to all
 * 6 faces (see CubeBehavior.applyRegionUV).
 */
export class CubeGallery {
  #cubeFactory: CubeFactory;
  #canvasManager: PixelArtCanvas;
  #cubes = new Map<string, CubeBehavior>();

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
      this.#cubes.set(region.id, cube);
      this.#relayout();
    });

    uv.on("region-deleted", ({ region }) => {
      const cube = this.#cubes.get(region.id);
      if (cube) {
        this.#cubeFactory.destroy(cube);
        this.#cubes.delete(region.id);
      }
      this.#relayout();
    });

    uv.on("region-moved", ({ region }) => {
      this.#cubes.get(region.id)?.updateRect(
        region.rect,
        this.#canvasManager.textureSize
      );
    });

    uv.on("region-dragging", ({ id, rect }) => {
      this.#cubes.get(id)?.updateRect(
        rect,
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
   * Current cube meshes, for a consumer (e.g. CubePicker) to raycast
   * against without reaching into the underlying cube map.
   */
  get meshes(): THREE.Object3D[] {
    return [...this.#cubes.values()].map((cube) => cube.mesh);
  }

  /**
   * Remaps every cube's UV against the canvas's current texture size.
   * Region rects don't change on import/resize (only what they're
   * normalized against does), so no "region-moved"/"region-dragging" event
   * fires to drive this on its own — the caller must invoke this after
   * replacing or resizing the texture.
   */
  refreshTextureSize(): void {
    const { textureSize } = this.#canvasManager;
    for (const region of this.#canvasManager.uv.regions) {
      this.#cubes.get(region.id)?.updateRect(region.rect, textureSize);
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
