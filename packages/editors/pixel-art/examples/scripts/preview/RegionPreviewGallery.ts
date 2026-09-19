// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  UVMap,
  UVMapListener,
  UVRegion,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { RegionPreview } from "./RegionPreviewBehavior.ts";
import { centeredGridPositions } from "./centeredGrid.ts";

// CONSTANTS
const kGridSpacing = 2.4;

export type CreateRegionPreview = (
  region: UVRegion,
  textureSize: Vec2
) => RegionPreview;

export interface RegionPreviewCanvas {
  readonly uv: UVMap;
  readonly textureSize: Vec2;
}

export interface RegionPreviewGalleryOptions {
  createPreview: CreateRegionPreview;
  canvasManager: RegionPreviewCanvas;
}

export class RegionPreviewGallery {
  readonly #createPreview: CreateRegionPreview;
  readonly #canvasManager: RegionPreviewCanvas;
  readonly #previews = new Map<string, RegionPreview>();
  #disposed = false;

  readonly #onRegionCreated: UVMapListener<"region-created"> = ({ region }) => {
    this.#addPreview(region);
  };

  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = ({ region }) => {
    this.#previews.get(region.id)?.dispose();
    this.#previews.delete(region.id);
    this.#relayout();
  };

  readonly #onSelectionChanged: UVMapListener<"selection-changed"> = ({
    selectedRegionId
  }) => {
    for (const [regionId, preview] of this.#previews) {
      preview.setSelected(regionId === selectedRegionId);
    }
  };

  constructor(
    options: RegionPreviewGalleryOptions
  ) {
    this.#createPreview = options.createPreview;
    this.#canvasManager = options.canvasManager;

    const { uv } = this.#canvasManager;
    uv.on("region-created", this.#onRegionCreated);
    uv.on("region-deleted", this.#onRegionDeleted);
    uv.on("selection-changed", this.#onSelectionChanged);

    for (const region of uv.regions) {
      this.#addPreview(region);
    }
    for (const [regionId, preview] of this.#previews) {
      preview.setSelected(regionId === uv.selectedRegionId);
    }
  }

  get meshes(): THREE.Object3D[] {
    return [
      ...this.#previews.values()
    ].map((preview) => preview.mesh);
  }

  refreshTextureSize(): void {
    const { textureSize } = this.#canvasManager;
    for (const preview of this.#previews.values()) {
      preview.setTextureSize(textureSize);
    }
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    const { uv } = this.#canvasManager;
    uv.off("region-created", this.#onRegionCreated);
    uv.off("region-deleted", this.#onRegionDeleted);
    uv.off("selection-changed", this.#onSelectionChanged);

    for (const preview of this.#previews.values()) {
      preview.dispose();
    }
    this.#previews.clear();
  }

  #addPreview(
    region: UVRegion
  ): void {
    this.#previews.get(region.id)?.dispose();
    this.#previews.delete(region.id);

    const preview = this.#createPreview(
      region,
      this.#canvasManager.textureSize
    );
    const referencePreview = this.#previews.values().next().value;
    if (referencePreview) {
      preview.setRotation(referencePreview.rotation);
    }
    preview.follow(this.#canvasManager.uv);

    this.#previews.set(region.id, preview);
    this.#relayout();
  }

  #relayout(): void {
    const previews = [...this.#previews.values()];
    const positions = centeredGridPositions(
      previews.length,
      kGridSpacing
    );

    previews.forEach((preview, index) => {
      preview.setTargetPosition(positions[index]);
    });
  }
}
