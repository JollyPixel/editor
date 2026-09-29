// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  LayerDropPosition,
  LayerRef
} from "./LayerRef.ts";

export class ObjectLayerRef {
  static readonly PREFIX = "object:";

  readonly kind = "object-layer";
  readonly name: string;

  constructor(
    name: string
  ) {
    this.name = name;
  }

  equals(
    other: LayerRef | null
  ): boolean {
    return other !== null && other.key === this.key;
  }

  get key(): string {
    return `${ObjectLayerRef.PREFIX}${this.name}`;
  }

  get objectLayer(): string {
    return this.name;
  }

  belongsTo(
    objectLayer: string
  ): boolean {
    return this.name === objectLayer;
  }

  exists(
    world: VoxelWorld
  ): boolean {
    return world.objectLayers.get(this.name) !== undefined;
  }

  canMoveOnto(
    _target: LayerRef,
    _where: LayerDropPosition
  ): boolean {
    return false;
  }

  moveOnto(
    _world: VoxelWorld,
    _target: LayerRef,
    _where: LayerDropPosition
  ): void {
    return void 0;
  }

  removalMessage(
    world: VoxelWorld
  ): string {
    const count = world.objectLayers.get(this.name)?.objects.length ?? 0;

    return count === 0 ?
      `Delete the object layer "${this.name}"?` :
      `Delete the object layer "${this.name}" and its ${count} object(s)?`;
  }

  removeFrom(
    world: VoxelWorld
  ): void {
    world.objectLayers.remove(this.name);
  }
}
