// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelTemplate,
  type VoxelTemplateBounds,
  type VoxelTransformOptions
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { PlacementSource } from "./PlacementSource.ts";

export class Placement {
  static at(
    source: PlacementSource,
    position: VoxelCoord
  ): Placement {
    return new Placement(
      source,
      position,
      VoxelTransform.Identity
    );
  }

  readonly source: PlacementSource;
  readonly position: Readonly<VoxelCoord>;
  readonly transform: VoxelTransform;

  constructor(
    source: PlacementSource,
    position: VoxelCoord,
    transform: VoxelTransform
  ) {
    this.source = source;
    this.position = Object.freeze({
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z)
    });
    this.transform = transform;

    Object.freeze(this);
  }

  movedTo(
    position: VoxelCoord
  ): Placement {
    return new Placement(this.source, position, this.transform);
  }

  turnedBy(
    options: VoxelTransformOptions
  ): Placement {
    const outer = VoxelTransform.fromPacked(VoxelTransform.pack(options));

    return new Placement(
      this.source,
      this.position,
      this.transform.followedBy(outer)
    );
  }

  boundsIn(
    template: VoxelTemplate
  ): VoxelTemplateBounds {
    return template.placedBounds(this.position, this.transform);
  }

  positionFor(
    template: VoxelTemplate,
    min: VoxelCoord
  ): VoxelCoord {
    return template.placedPositionFor(min, this.transform);
  }

  equals(
    other: Placement | null
  ): boolean {
    return other !== null &&
      other.source === this.source &&
      other.position.x === this.position.x &&
      other.position.y === this.position.y &&
      other.position.z === this.position.z &&
      other.transform.equals(this.transform);
  }
}
