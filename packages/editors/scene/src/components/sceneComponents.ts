// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  cameraForm,
  lightForm,
  meshForm,
  scriptForm,
  voxelMapForm,
  type ComponentForm
} from "./componentForms.ts";

export interface SceneComponentKind {
  type: string;
  label: string;
  icon: string;
  form: ComponentForm;
}

// CONSTANTS
export const EMPTY_ACTOR_ICON = "actor-empty";

export const SCENE_COMPONENTS: readonly SceneComponentKind[] = [
  {
    type: "Camera",
    label: "Camera",
    icon: "actor-camera",
    form: cameraForm
  },
  {
    type: "Light",
    label: "Light",
    icon: "actor-light",
    form: lightForm
  },
  {
    type: "Mesh",
    label: "Mesh",
    icon: "actor-mesh",
    form: meshForm
  },
  {
    type: "Script",
    label: "Script",
    icon: EMPTY_ACTOR_ICON,
    form: scriptForm
  },
  {
    type: "VoxelMap",
    label: "Voxel map",
    icon: "actor-voxel-map",
    form: voxelMapForm
  }
];

export function sceneComponent(
  type: string
): SceneComponentKind | undefined {
  return SCENE_COMPONENTS.find((kind) => kind.type === type);
}

export function componentIcon(
  type: string
): string {
  return sceneComponent(type)?.icon ?? EMPTY_ACTOR_ICON;
}

export function picksAssets(
  definitions: Systems.ComponentDefinitions,
  type: string
): boolean {
  return Object.keys(definitions.find(type)?.assets ?? {}).length > 0;
}
