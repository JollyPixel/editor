// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Placement } from "./Placement.ts";
import type { PlacementSource } from "./PlacementSource.ts";

export class PlacementSummary {
  static of(
    placement: Placement,
    world: VoxelWorld,
    target: string | null
  ): PlacementSummary {
    const { source } = placement;
    const name = source.kind === "layer" ?
      source.layerName :
      source.resolve(world)?.name ?? "";

    return new PlacementSummary(source.kind, name, target);
  }

  readonly kind: PlacementSource["kind"];
  readonly name: string;
  readonly target: string | null;

  constructor(
    kind: PlacementSource["kind"],
    name: string,
    target: string | null
  ) {
    this.kind = kind;
    this.name = name;
    this.target = target;

    Object.freeze(this);
  }

  get committable(): boolean {
    return this.target !== null;
  }

  get icon(): string {
    return this.kind === "layer" ? "voxel-layer" : "template";
  }

  get caption(): string {
    if (this.kind === "layer" || this.target === null) {
      return this.name;
    }

    return `${this.name} → ${this.target}`;
  }

  commitLabel(
    shortcut: string
  ): string {
    return this.target === null ?
      "Commit (add a voxel layer first)" :
      `Commit into ${this.target} (${shortcut})`;
  }
}
