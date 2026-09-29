// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  LayerDropPosition,
  LayerRef
} from "./LayerRef.ts";

export class VoxelLayerRef {
  static readonly PREFIX = "voxel:";

  readonly kind = "voxel-layer";
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
    return `${VoxelLayerRef.PREFIX}${this.name}`;
  }

  get objectLayer(): null {
    return null;
  }

  belongsTo(
    _objectLayer: string
  ): boolean {
    return false;
  }

  exists(
    world: VoxelWorld
  ): boolean {
    return world.getLayer(this.name) !== undefined;
  }

  canMoveOnto(
    target: LayerRef,
    where: LayerDropPosition
  ): boolean {
    return target.kind === "voxel-layer" && where !== "inside";
  }

  moveOnto(
    world: VoxelWorld,
    target: LayerRef,
    where: LayerDropPosition
  ): void {
    if (target.kind !== "voxel-layer" || where === "inside") {
      return;
    }

    const stack = world.getLayers().map((layer) => layer.name);
    const fromIndex = stack.indexOf(this.name);
    const targetIndex = stack.indexOf(target.name);
    if (fromIndex === -1 || targetIndex === -1) {
      return;
    }

    const insertAt = where === "above" ? targetIndex : targetIndex + 1;
    world.moveLayerTo(
      this.name,
      fromIndex < insertAt ? insertAt - 1 : insertAt
    );
  }

  removalMessage(
    _world: VoxelWorld
  ): string {
    return `Delete the voxel layer "${this.name}" and everything painted on it?`;
  }

  removeFrom(
    world: VoxelWorld
  ): void {
    world.removeLayer(this.name);
  }
}
