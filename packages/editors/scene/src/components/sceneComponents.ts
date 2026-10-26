// Import Third-party Dependencies
import type { AssetType } from "@jolly-pixel/asset";
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  ScriptDefinition,
  Systems
} from "@jolly-pixel/engine";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

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
  definition: Systems.AnyComponentDefinition;
  label: string;
  icon: string;
  form: ComponentForm;
}

// CONSTANTS
export const EMPTY_ACTOR_ICON = "actor-empty";

export const SCENE_COMPONENTS: readonly SceneComponentKind[] = [
  {
    definition: new CameraDefinition(),
    label: "Camera",
    icon: "actor-camera",
    form: cameraForm
  },
  {
    definition: new LightDefinition(),
    label: "Light",
    icon: "actor-light",
    form: lightForm
  },
  {
    definition: new MeshDefinition(),
    label: "Mesh",
    icon: "actor-mesh",
    form: meshForm
  },
  {
    definition: new ScriptDefinition({}),
    label: "Script",
    icon: EMPTY_ACTOR_ICON,
    form: scriptForm
  },
  {
    definition: new VoxelMapDefinition(),
    label: "Voxel map",
    icon: "actor-voxel-map",
    form: voxelMapForm
  }
];

export function createSceneDefinitions(): Systems.ComponentDefinitions {
  return new Systems.ComponentDefinitions().register(
    ...SCENE_COMPONENTS.map((kind) => kind.definition)
  );
}

export function sceneComponent(
  type: string
): SceneComponentKind | undefined {
  return SCENE_COMPONENTS.find((kind) => kind.definition.type === type);
}

export function componentIcon(
  type: string
): string {
  return sceneComponent(type)?.icon ?? EMPTY_ACTOR_ICON;
}

export function componentAssetSlots(
  type: string
): Readonly<Record<string, AssetType<unknown>>> {
  return sceneComponent(type)?.definition.assets ?? {};
}

export function picksAssets(
  type: string
): boolean {
  return Object.keys(componentAssetSlots(type)).length > 0;
}
