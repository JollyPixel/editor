// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import {
  packVoxel,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import { VoxelTransform } from "../../geometry/VoxelTransform.ts";
import type { VoxelCoord } from "../types.ts";
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelTemplatePatch } from "./types.ts";
import type { VoxelTemplateCaptureOptions } from "./VoxelTemplates.ts";

export interface VoxelTemplateOptions {
  id: string;
  name: string;
  /**
   * Cell that lands on the placement position, in the same space as
   * `positions`.
   * @default the bottom center of the voxels
   */
  pivot?: VoxelCoord;
  /**
   * @default {}
   */
  properties?: Record<string, any>;
  /**
   * `x, y, z` triples, one per voxel.
   */
  positions: ArrayLike<number>;
  voxels: ArrayLike<PackedVoxel>;
}

export type VoxelTemplateVoxel = [number, number, number, PackedVoxel];

export interface VoxelTemplateBounds {
  min: VoxelCoord;
  size: VoxelCoord;
}

export interface VoxelTemplateLayerOptions extends VoxelTemplateCaptureOptions {
  id: string;
}

/**
 * An immutable group of voxels saved with the world and copied into a layer
 * on placement. Positions are template-local, with the lowest corner of the
 * voxels at `0, 0, 0`.
 */
export class VoxelTemplate {
  static fromLayer(
    layer: VoxelLayer,
    options: VoxelTemplateLayerOptions
  ): VoxelTemplate {
    const { bounds } = options;
    const { x: ox, y: oy, z: oz } = layer.position;
    const positions: number[] = [];
    const voxels: PackedVoxel[] = [];
    for (const [lx, ly, lz, packed] of layer.localVoxels()) {
      const x = lx + ox;
      const y = ly + oy;
      const z = lz + oz;
      if (bounds === undefined || (
        x >= bounds.min.x && x < bounds.max.x &&
        y >= bounds.min.y && y < bounds.max.y &&
        z >= bounds.min.z && z < bounds.max.z
      )) {
        positions.push(x, y, z);
        voxels.push(packed);
      }
    }

    return new VoxelTemplate({
      id: options.id,
      name: options.name,
      pivot: options.pivot,
      properties: options.properties,
      positions,
      voxels
    });
  }

  readonly id: string;
  readonly name: string;
  readonly pivot: Readonly<VoxelCoord>;
  readonly properties: Readonly<Record<string, any>>;
  readonly size: Readonly<VoxelCoord>;

  #positions: Int32Array;
  #voxels: Uint32Array;

  constructor(
    options: VoxelTemplateOptions
  ) {
    const {
      id,
      name,
      pivot,
      properties = {},
      positions,
      voxels
    } = options;
    if (positions.length !== voxels.length * 3) {
      throw new RangeError(
        `VoxelTemplate: ${positions.length} coordinates for ` +
        `${voxels.length} voxels.`
      );
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) {
      const axis = i % 3;
      min[axis] = Math.min(min[axis], positions[i]);
      max[axis] = Math.max(max[axis], positions[i]);
    }
    if (voxels.length === 0) {
      min.fill(0);
      max.fill(-1);
    }

    this.#positions = Int32Array.from(
      positions,
      (value, i) => value - min[i % 3]
    );
    this.#voxels = Uint32Array.from(voxels);

    this.id = id;
    this.name = name;
    this.properties = Object.freeze(structuredClone(properties));
    this.size = Object.freeze({
      x: max[0] - min[0] + 1,
      y: max[1] - min[1] + 1,
      z: max[2] - min[2] + 1
    });
    this.pivot = Object.freeze(pivot === undefined ?
      {
        x: Math.floor(this.size.x / 2),
        y: 0,
        z: Math.floor(this.size.z / 2)
      } :
      {
        x: pivot.x - min[0],
        y: pivot.y - min[1],
        z: pivot.z - min[2]
      }
    );
  }

  get voxelCount(): number {
    return this.#voxels.length;
  }

  * localVoxels(): IterableIterator<VoxelTemplateVoxel> {
    const positions = this.#positions;

    for (let i = 0; i < this.#voxels.length; i++) {
      yield [
        positions[i * 3],
        positions[(i * 3) + 1],
        positions[(i * 3) + 2],
        this.#voxels[i]
      ];
    }
  }

  * placedVoxels(
    position: Vector3Like,
    transform: VoxelTransform = VoxelTransform.Identity
  ): IterableIterator<VoxelTemplateVoxel> {
    const { pivot } = this;

    for (const [x, y, z, packed] of this.localVoxels()) {
      const offset = transform.transformOffset({
        x: x - pivot.x,
        y: y - pivot.y,
        z: z - pivot.z
      });
      const turned = VoxelTransform
        .fromPacked(voxelTransform(packed))
        .followedBy(transform);

      yield [
        position.x + offset.x,
        position.y + offset.y,
        position.z + offset.z,
        packVoxel(voxelBlockId(packed), turned.packed)
      ];
    }
  }

  placedBounds(
    position: Vector3Like,
    transform: VoxelTransform = VoxelTransform.Identity
  ): VoxelTemplateBounds {
    const [low, high] = this.#turnedCorners(transform);

    return {
      min: {
        x: position.x + low.x,
        y: position.y + low.y,
        z: position.z + low.z
      },
      size: {
        x: high.x - low.x + 1,
        y: high.y - low.y + 1,
        z: high.z - low.z + 1
      }
    };
  }

  placedPositionFor(
    min: Vector3Like,
    transform: VoxelTransform = VoxelTransform.Identity
  ): VoxelCoord {
    const [low] = this.#turnedCorners(transform);

    return {
      x: min.x - low.x,
      y: min.y - low.y,
      z: min.z - low.z
    };
  }

  transformed(
    transform: VoxelTransform
  ): VoxelTemplate {
    const positions: number[] = [];
    const voxels: PackedVoxel[] = [];
    for (const [x, y, z, packed] of this.placedVoxels(this.pivot, transform)) {
      positions.push(x, y, z);
      voxels.push(packed);
    }

    return new VoxelTemplate({
      id: this.id,
      name: this.name,
      pivot: this.pivot,
      properties: this.properties,
      positions,
      voxels
    });
  }

  countBlocks(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const packed of this.#voxels) {
      const blockId = voxelBlockId(packed);
      counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
    }

    return counts;
  }

  withPatch(
    patch: VoxelTemplatePatch
  ): VoxelTemplate {
    return new VoxelTemplate({
      id: this.id,
      name: patch.name ?? this.name,
      pivot: patch.pivot ?? this.pivot,
      properties: patch.properties ?? this.properties,
      positions: this.#positions,
      voxels: this.#voxels
    });
  }

  #turnedCorners(
    transform: VoxelTransform
  ): [low: VoxelCoord, high: VoxelCoord] {
    const { pivot, size } = this;
    const a = transform.transformOffset({
      x: -pivot.x,
      y: -pivot.y,
      z: -pivot.z
    });
    const b = transform.transformOffset({
      x: size.x - 1 - pivot.x,
      y: size.y - 1 - pivot.y,
      z: size.z - 1 - pivot.z
    });

    return [
      {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        z: Math.min(a.z, b.z)
      },
      {
        x: Math.max(a.x, b.x),
        y: Math.max(a.y, b.y),
        z: Math.max(a.z, b.z)
      }
    ];
  }
}
