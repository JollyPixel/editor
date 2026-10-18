// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapDocument } from "../../document/MapDocument.ts";

export class MergePlan {
  static planMerge(
    world: VoxelWorld,
    sourceName: string
  ): MergePlan {
    const layers = MapDocument.layers(world);
    const source = layers.find((layer) => layer.name === sourceName);
    if (source === undefined) {
      return new MergePlan([], []);
    }

    const targets = layers
      .filter((layer) => layer.name !== sourceName)
      .map((layer) => layer.name);
    const warnings: string[] = [];
    const propertyCount = Object.keys(source.properties).length;
    if (propertyCount > 0) {
      warnings.push(
        `Its ${propertyCount} custom propertie(s) are folded in behind the ` +
        "target's own, and the target wins where both define a key."
      );
    }
    if (!source.visible) {
      warnings.push("It is hidden, so its voxels become visible once merged.");
    }

    return new MergePlan(targets, warnings);
  }

  readonly targets: readonly string[];
  readonly warnings: readonly string[];

  constructor(
    targets: readonly string[],
    warnings: readonly string[]
  ) {
    this.targets = targets;
    this.warnings = warnings;
  }
}
