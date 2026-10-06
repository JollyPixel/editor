// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelTemplate,
  VoxelTemplateBounds
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Placement } from "./Placement.ts";
import type { PlacementSource } from "./PlacementSource.ts";

export class ActivePlacement {
  readonly placement: Placement;
  readonly template: VoxelTemplate;
  readonly target: string | null;

  constructor(
    placement: Placement,
    template: VoxelTemplate,
    target: string | null
  ) {
    this.placement = placement;
    this.template = template;
    this.target = target;

    Object.freeze(this);
  }

  get kind(): PlacementSource["kind"] {
    return this.placement.source.kind;
  }

  get name(): string {
    const { source } = this.placement;

    return source.kind === "layer"
      ? source.layerName
      : this.template.name;
  }

  get bounds(): VoxelTemplateBounds {
    return this.placement.boundsIn(this.template);
  }

  get committable(): boolean {
    return this.target !== null;
  }

  get icon(): string {
    return this.kind === "layer" ? "voxel-layer" : "template";
  }

  get caption(): string {
    if (
      this.kind === "layer" ||
      this.target === null
    ) {
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

  positionFor(
    min: VoxelCoord
  ): VoxelCoord {
    return this.placement.positionFor(
      this.template,
      min
    );
  }

  equals(
    other: ActivePlacement | null
  ): boolean {
    return other !== null &&
      other.placement.equals(this.placement) &&
      other.template === this.template &&
      other.target === this.target;
  }
}
