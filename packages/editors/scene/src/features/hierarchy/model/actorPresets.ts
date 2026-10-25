// Import Third-party Dependencies
import type { JSONObject } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import {
  GEOMETRY_KINDS,
  LIGHT_KINDS
} from "../../../components/componentForms.ts";
import {
  componentIcon,
  EMPTY_ACTOR_ICON
} from "../../../components/sceneComponents.ts";

export type ActorPresetGroup = "Actor" | "Light" | "Primitive" | "Asset";

export interface ActorPreset {
  id: string;
  label: string;
  group: ActorPresetGroup;
  component: {
    type: string;
    data: JSONObject;
  } | null;
}

// CONSTANTS
const kShadowCasters: ReadonlySet<string> = new Set(["directional", "spot"]);

export const ACTOR_PRESETS: readonly ActorPreset[] = [
  {
    id: "empty",
    label: "Empty",
    group: "Actor",
    component: null
  },
  {
    id: "camera",
    label: "Camera",
    group: "Actor",
    component: {
      type: "Camera",
      data: {}
    }
  },
  ...LIGHT_KINDS.map(({ value: kind, label }): ActorPreset => {
    return {
      id: `light:${kind}`,
      label: `${label} Light`,
      group: "Light",
      component: {
        type: "Light",
        data: kShadowCasters.has(kind) ?
          { kind, castShadow: true } :
          { kind }
      }
    };
  }),
  ...GEOMETRY_KINDS.map(({ value: kind, label }): ActorPreset => {
    return {
      id: `mesh:${kind}`,
      label,
      group: "Primitive",
      component: {
        type: "Mesh",
        data: {
          geometry: { kind },
          castShadow: true,
          receiveShadow: true
        }
      }
    };
  }),
  {
    id: "voxel-map",
    label: "Voxel map",
    group: "Asset",
    component: {
      type: "VoxelMap",
      data: {}
    }
  }
];

export function presetIcon(
  preset: ActorPreset
): string {
  return preset.component === null ?
    EMPTY_ACTOR_ICON :
    componentIcon(preset.component.type);
}
