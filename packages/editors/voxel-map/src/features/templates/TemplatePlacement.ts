// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelTemplate,
  type VoxelTemplateBounds,
  type VoxelTransformOptions
} from "@jolly-pixel/voxel.renderer";

export class TemplatePlacement {
  static at(
    templateId: string,
    position: VoxelCoord
  ): TemplatePlacement {
    return new TemplatePlacement(
      templateId,
      position,
      VoxelTransform.Identity
    );
  }

  readonly templateId: string;
  readonly position: Readonly<VoxelCoord>;
  readonly transform: VoxelTransform;

  constructor(
    templateId: string,
    position: VoxelCoord,
    transform: VoxelTransform
  ) {
    this.templateId = templateId;
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
  ): TemplatePlacement {
    return new TemplatePlacement(this.templateId, position, this.transform);
  }

  turnedBy(
    options: VoxelTransformOptions
  ): TemplatePlacement {
    const outer = VoxelTransform.fromPacked(VoxelTransform.pack(options));

    return new TemplatePlacement(
      this.templateId,
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
    other: TemplatePlacement | null
  ): boolean {
    return other !== null &&
      other.templateId === this.templateId &&
      other.position.x === this.position.x &&
      other.position.y === this.position.y &&
      other.position.z === this.position.z &&
      other.transform.equals(this.transform);
  }
}
