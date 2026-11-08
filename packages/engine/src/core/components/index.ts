export * from "./script/Behavior.ts";
export * from "./script/ScriptDefinition.ts";
export {
  SceneProperty,
  SceneActorComponent,
  InputListener,
  type ScenePropertyOptions
} from "./script/BehaviorDecorators.ts";
export {
  SCENE_PROPERTY_TYPES,
  inferScenePropertyType,
  type ScenePropertyType,
  type BehaviorPropertyType
} from "./script/ScenePropertyValue.ts";

export type {
  Component,
  ComponentClass,
  FreeComponentEnum,
  StrictComponentEnum
} from "./types.ts";
