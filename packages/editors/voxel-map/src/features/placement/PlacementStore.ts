// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelTransformOptions,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { Placement } from "./Placement.ts";
import type { PlacementSource } from "./PlacementSource.ts";

export type PlacementStoreEvents = {
  change: (
    placement: Placement | null
  ) => void;
};

export class PlacementStore extends Emitter<PlacementStoreEvents> {
  #placement: Placement | null = null;

  get placement(): Placement | null {
    return this.#placement;
  }

  get placing(): boolean {
    return this.#placement !== null;
  }

  begin(
    source: PlacementSource,
    position: VoxelCoord
  ): void {
    this.#assign(Placement.at(source, position));
  }

  move(
    position: VoxelCoord
  ): void {
    this.#assign(this.#placement?.movedTo(position) ?? null);
  }

  transform(
    transform: VoxelTransformOptions
  ): void {
    this.#assign(this.#placement?.turnedBy(transform) ?? null);
  }

  end(): void {
    if (this.#placement !== null) {
      this.#placement = null;
      this.emit("change", null);
    }
  }

  reconcile(
    world: VoxelWorld
  ): void {
    if (this.#placement?.source.resolve(world) === undefined) {
      this.end();
    }
  }

  #assign(
    placement: Placement | null
  ): void {
    if (placement === null || placement.equals(this.#placement)) {
      return;
    }

    this.#placement = placement;
    this.emit("change", placement);
  }
}
