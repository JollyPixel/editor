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
  type ComponentForm,
  type FormRow,
  type ParsedData
} from "./componentForms.ts";

export interface ParsedForm {
  data: ParsedData;
  rows: FormRow[];
}

export interface SceneComponentKind {
  definition: Systems.AnyComponentDefinition;
  label: string;
  icon: string;
  form: (stored: Readonly<Systems.JSONObject>) => ParsedForm;
}

interface TypedComponentKind<TData extends object> {
  definition: Systems.ComponentDefinition<TData, any, any>;
  label: string;
  icon: string;
  form: ComponentForm<TData>;
}

// CONSTANTS
export const EMPTY_ACTOR_ICON = "actor-empty";

export const SCENE_COMPONENTS: readonly SceneComponentKind[] = [
  componentKind({
    definition: new CameraDefinition(),
    label: "Camera",
    icon: "actor-camera",
    form: cameraForm
  }),
  componentKind({
    definition: new LightDefinition(),
    label: "Light",
    icon: "actor-light",
    form: lightForm
  }),
  componentKind({
    definition: new MeshDefinition(),
    label: "Mesh",
    icon: "actor-mesh",
    form: meshForm
  }),
  componentKind({
    definition: new ScriptDefinition({}),
    label: "Script",
    icon: EMPTY_ACTOR_ICON,
    form: scriptForm
  }),
  componentKind({
    definition: new VoxelMapDefinition(),
    label: "Voxel map",
    icon: "actor-voxel-map",
    form: voxelMapForm
  })
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

export function actorIcon(
  types: Iterable<string>
): string {
  for (const type of types) {
    const icon = componentIcon(type);
    if (icon !== EMPTY_ACTOR_ICON) {
      return icon;
    }
  }

  return EMPTY_ACTOR_ICON;
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

function componentKind<TData extends object>(
  kind: TypedComponentKind<TData>
): SceneComponentKind {
  const { definition, form } = kind;

  return {
    ...kind,
    form: (stored) => {
      const data = definition.parse(stored);

      return {
        data,
        rows: form(data)
      };
    }
  };
}
