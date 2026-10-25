// Import Third-party Dependencies
import {
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { VoxelRenderer } from "./VoxelRenderer.ts";
import {
  VOXEL_MAP_ASSET,
  type VoxelMapSource
} from "./VoxelMapSource.ts";

export interface VoxelMapSettings {
  castShadow: boolean;
  receiveShadow: boolean;
  layers: Readonly<Record<string, boolean>>;
}

export type VoxelMapAssets = {
  map: VoxelMapSource;
};

// CONSTANTS
export const VOXEL_MAP_DEFAULTS = {
  castShadow: false,
  receiveShadow: false,
  layers: {}
} as const satisfies VoxelMapSettings;

export class VoxelMapDefinition implements Systems.ComponentDefinition<
  VoxelMapSettings,
  VoxelRenderer,
  VoxelMapAssets
> {
  readonly type = "VoxelMap";
  readonly assets = {
    map: VOXEL_MAP_ASSET
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): VoxelMapSettings {
    const fields = new Systems.ComponentData(data);

    return {
      castShadow: fields.boolean(
        "castShadow",
        VOXEL_MAP_DEFAULTS.castShadow
      ),
      receiveShadow: fields.boolean(
        "receiveShadow",
        VOXEL_MAP_DEFAULTS.receiveShadow
      ),
      layers: parseLayers(data.layers)
    };
  }

  create(
    actor: Actor<any>,
    data: VoxelMapSettings,
    context: Systems.ComponentContext<VoxelMapAssets>
  ): VoxelRenderer | null {
    const map = context.assets.resolve("map");
    if (map === null) {
      return null;
    }

    const renderer = actor.addComponentAndGet(VoxelRenderer, {
      document: map.document
    });
    renderer.addTeardown(
      map.attach(renderer.view)
    );
    this.apply(renderer, data);

    return renderer;
  }

  apply(
    renderer: VoxelRenderer,
    data: VoxelMapSettings
  ): void {
    const { lighting, layerVisibility } = renderer.view;

    lighting.castShadow = data.castShadow;
    lighting.receiveShadow = data.receiveShadow;
    for (const layerName of [...layerVisibility.overrides.keys()]) {
      if (!Object.hasOwn(data.layers, layerName)) {
        layerVisibility.reset(layerName);
      }
    }
    for (const [layerName, visible] of Object.entries(data.layers)) {
      layerVisibility.override(layerName, visible);
    }
  }
}

function parseLayers(
  value: Systems.JSONValue | undefined
): Record<string, boolean> {
  if (!Systems.isJSONObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
    )
  );
}
