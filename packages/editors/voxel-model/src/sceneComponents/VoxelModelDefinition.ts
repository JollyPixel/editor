// Import Third-party Dependencies
import {
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  VOXEL_MODEL_SOURCE,
  type VoxelModelSource
} from "../viewer/VoxelModelSource.ts";
import { VoxelModelRenderer } from "./VoxelModelRenderer.ts";

export interface VoxelModelSettings {
  castShadow: boolean;
  receiveShadow: boolean;
}

export type VoxelModelAssets = {
  model: VoxelModelSource;
};

// CONSTANTS
export const VOXEL_MODEL_DEFAULTS = {
  castShadow: false,
  receiveShadow: false
} as const satisfies VoxelModelSettings;

export class VoxelModelDefinition implements Systems.ComponentDefinition<
  VoxelModelSettings,
  VoxelModelRenderer,
  VoxelModelAssets
> {
  readonly type = "VoxelModel";
  readonly assets = {
    model: VOXEL_MODEL_SOURCE
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): VoxelModelSettings {
    const fields = new Systems.ComponentData(data);

    return {
      castShadow: fields.boolean(
        "castShadow",
        VOXEL_MODEL_DEFAULTS.castShadow
      ),
      receiveShadow: fields.boolean(
        "receiveShadow",
        VOXEL_MODEL_DEFAULTS.receiveShadow
      )
    };
  }

  create(
    actor: Actor<any>,
    data: VoxelModelSettings,
    context: Systems.ComponentContext<VoxelModelAssets>
  ): VoxelModelRenderer | null {
    const source = context.assets.resolve("model");
    if (source === null) {
      return null;
    }

    const renderer = actor.addComponentAndGet(VoxelModelRenderer, {
      document: source.document,
      texture: source.texture
    });
    renderer.addTeardown(
      source.attach(renderer.view)
    );
    this.apply(renderer, data);

    return renderer;
  }

  apply(
    renderer: VoxelModelRenderer,
    data: VoxelModelSettings
  ): void {
    renderer.view.castShadow = data.castShadow;
    renderer.view.receiveShadow = data.receiveShadow;
  }

  capture(
    renderer: VoxelModelRenderer
  ): Systems.JSONObject {
    return {
      castShadow: renderer.view.castShadow,
      receiveShadow: renderer.view.receiveShadow
    };
  }
}
