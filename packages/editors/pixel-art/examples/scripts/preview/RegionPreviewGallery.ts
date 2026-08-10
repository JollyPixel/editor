// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  UVMap,
  UVMapListener,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { RegionPreview } from "./RegionPreviewBehavior.ts";
import type { RegionPreviewFactoryContract } from "./RegionPreviewFactory.ts";
import { centeredGridPositions } from "./centeredGrid.ts";

// CONSTANTS
const kGridSpacing = 2.4;

export interface RegionPreviewGalleryOptions {
  previewFactory: RegionPreviewFactoryContract;
  canvasManager: RegionPreviewCanvas;
}

export interface RegionPreviewCanvas {
  readonly uv: UVMap;
  readonly textureSize: Vec2;
}

export interface RegionPreviewGalleryAppearance {
  borderColor: THREE.ColorRepresentation;
}

export class RegionPreviewGallery {
  readonly #previewFactory: RegionPreviewFactoryContract;
  readonly #canvasManager: RegionPreviewCanvas;
  readonly #previews = new Map<string, RegionPreview>();
  #appearance: RegionPreviewGalleryAppearance = {
    borderColor: "#101820"
  };
  #rotating = true;
  #disposed = false;

  readonly #onRegionCreated: UVMapListener<"region-created"> = ({ region }) => {
    // Replacing a map entry would leave its actor in the scene forever, so
    // never hold two previews for one id.
    const stale = this.#previews.get(region.id);
    if (stale) {
      this.#previewFactory.destroy(stale);
      this.#previews.delete(region.id);
    }

    const preview = this.#previewFactory.create(
      region,
      this.#canvasManager.textureSize
    );
    const referencePreview = this.#previews.values().next().value;
    if (referencePreview) {
      preview.setRotation(referencePreview.rotation);
    }

    this.#previews.set(region.id, preview);
    this.#relayout();
    preview.setBorderColor(this.#appearance.borderColor);
    preview.setRotating(this.#rotating);
  };

  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = ({ region }) => {
    const preview = this.#previews.get(region.id);
    if (preview) {
      this.#previewFactory.destroy(preview);
      this.#previews.delete(region.id);
    }
    this.#relayout();
  };

  readonly #onRegionMoved: UVMapListener<"region-moved"> = ({ region, face }) => {
    this.#previews.get(region.id)?.applyFace(
      face,
      region.geometryFor(face ?? "front"),
      this.#canvasManager.textureSize
    );
  };

  readonly #onRegionDragging: UVMapListener<"region-dragging"> = ({
    id,
    face,
    geometry
  }) => {
    this.#previews.get(id)?.applyFace(
      face,
      geometry,
      this.#canvasManager.textureSize
    );
  };

  readonly #onRegionStateChanged: UVMapListener<"region-state-changed"> = ({
    region
  }) => {
    this.#previews.get(region.id)?.applyRegion(
      region,
      this.#canvasManager.textureSize
    );
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
    this.#previewFactory = options.previewFactory;
    this.#canvasManager = options.canvasManager;

    const { uv } = this.#canvasManager;
    uv.on("region-created", this.#onRegionCreated);
    uv.on("region-deleted", this.#onRegionDeleted);
    uv.on("region-moved", this.#onRegionMoved);
    uv.on("region-dragging", this.#onRegionDragging);
    uv.on("region-state-changed", this.#onRegionStateChanged);
    uv.on("selection-changed", this.#onSelectionChanged);
  }

  get meshes(): THREE.Object3D[] {
    return [
      ...this.#previews.values()
    ].map((preview) => preview.mesh);
  }

  refreshTextureSize(): void {
    const { textureSize } = this.#canvasManager;
    for (const region of this.#canvasManager.uv.regions) {
      this.#previews
        .get(region.id)
        ?.applyRegion(region, textureSize);
    }
  }

  setAppearance(
    appearance: RegionPreviewGalleryAppearance
  ): void {
    this.#appearance = appearance;
    for (const preview of this.#previews.values()) {
      preview.setBorderColor(appearance.borderColor);
    }
  }

  setRotating(
    rotating: boolean
  ): void {
    this.#rotating = rotating;
    for (const preview of this.#previews.values()) {
      preview.setRotating(rotating);
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
    uv.off("region-moved", this.#onRegionMoved);
    uv.off("region-dragging", this.#onRegionDragging);
    uv.off("region-state-changed", this.#onRegionStateChanged);
    uv.off("selection-changed", this.#onSelectionChanged);

    for (const preview of this.#previews.values()) {
      this.#previewFactory.destroy(preview);
    }
    this.#previews.clear();
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
