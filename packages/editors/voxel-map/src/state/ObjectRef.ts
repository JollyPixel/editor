// Import Third-party Dependencies
import type {
  VoxelObjectJSON,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  LayerDropPosition,
  LayerRef
} from "./LayerRef.ts";
import { ObjectLayerRef } from "./ObjectLayerRef.ts";

export class ObjectRef {
  static readonly PREFIX = "obj:";

  readonly kind = "object";
  readonly layerName: string;
  readonly objectId: string;

  constructor(
    layerName: string,
    objectId: string
  ) {
    this.layerName = layerName;
    this.objectId = objectId;
  }

  equals(
    other: LayerRef | null
  ): boolean {
    return other !== null && other.key === this.key;
  }

  get key(): string {
    return `${ObjectRef.PREFIX}${this.layerName}/${this.objectId}`;
  }

  get objectLayer(): string {
    return this.layerName;
  }

  get layer(): ObjectLayerRef {
    return new ObjectLayerRef(this.layerName);
  }

  belongsTo(
    objectLayer: string
  ): boolean {
    return this.layerName === objectLayer;
  }

  exists(
    world: VoxelWorld
  ): boolean {
    return this.objectIn(world) !== undefined;
  }

  objectIn(
    world: VoxelWorld
  ): VoxelObjectJSON | undefined {
    return world.objectLayers.getObject(this.layerName, this.objectId);
  }

  update(
    world: VoxelWorld,
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    return world.objectLayers.updateObject(
      this.layerName,
      this.objectId,
      patch
    );
  }

  canMoveOnto(
    target: LayerRef,
    where: LayerDropPosition
  ): boolean {
    return target.kind === "object-layer" &&
      where === "inside" &&
      target.name !== this.layerName;
  }

  moveOnto(
    world: VoxelWorld,
    target: LayerRef,
    where: LayerDropPosition
  ): void {
    if (this.canMoveOnto(target, where) && target.kind === "object-layer") {
      world.objectLayers.moveObject(this.layerName, this.objectId, target.name);
    }
  }

  removalMessage(
    _world: VoxelWorld
  ): null {
    return null;
  }

  removeFrom(
    world: VoxelWorld
  ): void {
    world.objectLayers.removeObject(this.layerName, this.objectId);
  }
}
