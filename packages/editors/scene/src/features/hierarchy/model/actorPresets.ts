// Import Internal Dependencies
import {
  GEOMETRY_KINDS,
  LIGHT_KINDS
} from "../../../components/componentForms.ts";
import { ActorPreset } from "./ActorPreset.ts";
import { ActorPresetMenu } from "./ActorPresetMenu.ts";
import { ActorPresetSubmenu } from "./ActorPresetSubmenu.ts";

// CONSTANTS
const kShadowCasters: ReadonlySet<string> = new Set(["directional", "spot"]);

export const ACTOR_PRESET_MENU = new ActorPresetMenu([
  [
    new ActorPreset({
      id: "empty",
      label: "Empty",
      components: []
    }),
    new ActorPreset({
      id: "camera",
      label: "Camera",
      components: [
        {
          type: "Camera",
          data: {}
        }
      ]
    })
  ],
  [
    new ActorPresetSubmenu(
      "Light",
      LIGHT_KINDS.map(({ value: kind, label }) => new ActorPreset({
        id: `light:${kind}`,
        label: `${label} Light`,
        components: [
          {
            type: "Light",
            data: kShadowCasters.has(kind) ?
              { kind, castShadow: true } :
              { kind }
          }
        ]
      }))
    ),
    new ActorPresetSubmenu(
      "Primitive",
      GEOMETRY_KINDS.map(({ value: kind, label }) => new ActorPreset({
        id: `mesh:${kind}`,
        label,
        components: [
          {
            type: "Mesh",
            data: {
              geometry: { kind },
              castShadow: true,
              receiveShadow: true
            }
          }
        ]
      }))
    )
  ],
  [
    new ActorPreset({
      id: "voxel-map",
      label: "Voxel map",
      components: [
        {
          type: "VoxelMap",
          data: {}
        }
      ]
    })
  ]
]);
