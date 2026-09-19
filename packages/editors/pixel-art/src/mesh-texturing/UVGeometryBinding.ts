// Import Third-party Dependencies
import type * as THREE from "three";
import {
  rotationOf,
  type UVSlot,
  type UVGeometry,
  type UVMap,
  type UVMapListener,
  type UVRegion,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  applyUvGeometry,
  applyUvRect
} from "./applyUvGeometry.ts";
import type { FaceRanges } from "./types.ts";

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

  #region: UVRegion;
  #textureSize: Vec2;
  #uv: UVMap | null = null;

  readonly #onRegionMoved: UVMapListener<"region-moved"> = ({ region, face }) => {
    if (region.id !== this.#region.id) {
      return;
    }

    this.#region = region;
    this.applyFace(
      face,
      region.geometryFor(face ?? "front")
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

    if (face === null) {
      this.#applySlots(this.#region.withRect(rect));

      return;
    }

    this.applyFace(
      face,
      geometry
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
    const uvAttribute = this.#geometry.getAttribute("uv");

    if (face === null) {
      applyUvRect({
        uvAttribute,
        baseUv: this.#baseUv,
        rect: "shape" in geometry ? geometry.rect : geometry,
        rotation: rotationOf(geometry),
        textureSize: this.#textureSize,
        ranges: [
          {
            start: 0,
            count: uvAttribute.count
          }
        ]
      });
    }
    else {
      const ranges = this.#faceRanges[face];
      if (!ranges || ranges.length === 0) {
        return;
      }
      applyUvGeometry(
        uvAttribute,
        this.#baseUv,
        geometry,
        this.#textureSize,
        ranges
      );
    }

    uvAttribute.needsUpdate = true;
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
