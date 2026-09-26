// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  rectOf,
  rotationOf,
  withRotation,
  type UVSlot,
  type UVGeometry,
  type UVMap,
  type UVMapListener,
  type UVRegion,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyUvGeometry } from "./applyUvGeometry.ts";
import type { FaceRanges, FaceVertexRange } from "./types.ts";

export interface UVGeometryBindingOptions {
  geometry: THREE.BufferGeometry;
  region: UVRegion;
  textureSize: Vec2;
  faceRanges: FaceRanges;
}

export class UVGeometryBinding {
  readonly #geometry: THREE.BufferGeometry;
  readonly #faceRanges: FaceRanges;
  readonly #baseUv: Float32Array;
  readonly #wholeMesh: readonly FaceVertexRange[];

  #region: UVRegion;
  #textureSize: Vec2;
  #uv: UVMap | null = null;

  readonly #onRegionMoved: UVMapListener<"region-moved"> = ({ region, face }) => {
    if (region.id !== this.#region.id) {
      return;
    }

    this.#region = region;
    if (face === null) {
      this.#applyRegion();

      return;
    }

    this.applyFace(
      face,
      region.geometryFor(face)
    );
  };

  readonly #onRegionDragging: UVMapListener<"region-dragging"> = ({
    id,
    face,
    rect,
    geometry
  }) => {
    if (id !== this.#region.id) {
      return;
    }

    this.preview(
      face,
      face === null ? rect : geometry
    );
  };

  readonly #onRegionReplaced: UVMapListener<"region-state-changed"> = ({
    region
  }) => {
    if (region.id !== this.#region.id) {
      return;
    }

    this.setRegion(region);
  };

  constructor(
    options: UVGeometryBindingOptions
  ) {
    this.#geometry = options.geometry;
    this.#faceRanges = options.faceRanges;
    this.#region = options.region;
    this.#textureSize = options.textureSize;
    const uvAttribute = this.#geometry.getAttribute("uv");
    this.#baseUv = new Float32Array(uvAttribute.count * 2);
    for (let index = 0; index < uvAttribute.count; index++) {
      this.#baseUv[index * 2] = uvAttribute.getX(index);
      this.#baseUv[index * 2 + 1] = uvAttribute.getY(index);
    }
    this.#wholeMesh = [
      {
        start: 0,
        count: uvAttribute.count
      }
    ];

    this.#applyRegion();
  }

  get regionId(): string {
    return this.#region.id;
  }

  setRegion(
    region: UVRegion
  ): void {
    this.#region = region;
    this.#applyRegion();
  }

  setTextureSize(
    size: Vec2
  ): void {
    this.#textureSize = size;
    this.#applyRegion();
  }

  applyFace(
    face: UVSlot | null,
    geometry: UVGeometry
  ): void {
    const ranges = face === null ? this.#wholeMesh : this.#faceRanges[face];
    if (!ranges || ranges.length === 0) {
      return;
    }

    applyUvGeometry(
      this.#geometry,
      this.#baseUv,
      face === null ?
        withRotation(rectOf(geometry), rotationOf(geometry)) :
        geometry,
      this.#textureSize,
      ranges
    );
  }

  preview(
    face: UVSlot | null,
    geometry: UVGeometry
  ): void {
    if (face === null) {
      this.#applySlots(
        this.#region.withRect(rectOf(geometry))
      );

      return;
    }

    this.applyFace(
      face,
      geometry
    );
  }

  follow(
    uv: UVMap
  ): void {
    if (this.#uv === uv) {
      return;
    }
    this.unfollow();

    this.#uv = uv;
    uv.on("region-moved", this.#onRegionMoved);
    uv.on("region-dragging", this.#onRegionDragging);
    uv.on("region-state-changed", this.#onRegionReplaced);
    uv.on("region-rotated", this.#onRegionReplaced);
  }

  unfollow(): void {
    if (this.#uv === null) {
      return;
    }

    this.#uv.off("region-moved", this.#onRegionMoved);
    this.#uv.off("region-dragging", this.#onRegionDragging);
    this.#uv.off("region-state-changed", this.#onRegionReplaced);
    this.#uv.off("region-rotated", this.#onRegionReplaced);
    this.#uv = null;
  }

  #applyRegion(): void {
    this.#applySlots(this.#region);
  }

  #applySlots(
    region: UVRegion
  ): void {
    for (const { slot, geometry } of region.slotsOf()) {
      this.applyFace(slot, geometry);
    }
  }
}
