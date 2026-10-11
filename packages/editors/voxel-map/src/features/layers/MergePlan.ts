// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { JollyOption } from "@jolly-pixel/ui";

export class MergePlan {
  static planMerge(
    world: VoxelWorld,
    sourceName: string
  ): MergePlan {
    const layers = world.getLayers();
    const sourceIndex = layers.findIndex((layer) => layer.name === sourceName);
    const source = layers[sourceIndex];
    if (source === undefined) {
      return new MergePlan(sourceName, [], null, []);
    }

    const options = layers
      .filter((layer) => layer.name !== sourceName)
      .map((layer): JollyOption<string> => {
        return {
          value: layer.name,
          label: layer.name
        };
      });
    const below = layers[sourceIndex + 1];
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

    return new MergePlan(
      sourceName,
      options,
      options.length === 0 ? null : below?.name ?? options[0].value,
      warnings
    );
  }

  readonly sourceName: string;
  readonly options: readonly JollyOption<string>[];
  readonly defaultTarget: string | null;
  readonly warnings: readonly string[];

  constructor(
    sourceName: string,
    options: readonly JollyOption<string>[],
    defaultTarget: string | null,
    warnings: readonly string[]
  ) {
    this.sourceName = sourceName;
    this.options = options;
    this.defaultTarget = defaultTarget;
    this.warnings = warnings;
  }
}
