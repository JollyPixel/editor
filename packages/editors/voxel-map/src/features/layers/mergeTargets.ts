// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { JollyOption } from "@jolly-pixel/ui";

export interface MergeTargets {
  options: JollyOption<string>[];
  defaultTarget: string | null;
}

export function mergeTargetsFor(
  world: VoxelWorld,
  sourceName: string
): MergeTargets {
  const layers = world.getLayers();
  const sourceIndex = layers.findIndex(
    (layer) => layer.name === sourceName
  );
  if (sourceIndex === -1) {
    return {
      options: [],
      defaultTarget: null
    };
  }

  const options = layers
    .filter((layer) => layer.name !== sourceName)
    .map((layer): JollyOption<string> => {
      return {
        value: layer.name,
        label: layer.name
      };
    });
  if (options.length === 0) {
    return {
      options,
      defaultTarget: null
    };
  }

  const below = layers[sourceIndex + 1];

  return {
    options,
    defaultTarget: below?.name ?? options[0].value
  };
}

export function mergeWarnings(
  world: VoxelWorld,
  sourceName: string
): string[] {
  const source = world.getLayer(sourceName);
  if (source === undefined) {
    return [];
  }

  const warnings: string[] = [];
  const propertyCount = Object.keys(source.properties).length;
  if (propertyCount > 0) {
    warnings.push(
      `Its ${propertyCount} custom propertie(s) are folded in behind the ` +
      "target's own, and the target wins where both define a key."
    );
  }
  if (!source.visible || source.opacity === 0) {
    warnings.push(
      "It is hidden, so its voxels become visible once merged."
    );
  }

  return warnings;
}
