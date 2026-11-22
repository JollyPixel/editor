export * from "./script/Behavior.ts";
export * from "./script/ScriptDefinition.ts";
export {
  SceneProperty,
  SceneActorComponent,
  InputListener,
  type BehaviorFieldDecorator,
  type BehaviorMethodDecorator,
  type ScenePropertyOptions
} from "./script/BehaviorDecorators.ts";
export {
  ASSET_PROPERTY_TYPES,
  SCENE_PROPERTY_TYPES,
  inferScenePropertyType,
  isScriptPropertySlot,
  scriptPropertySlot,
  type AssetPropertyType,
  type ScenePropertyType,
  type BehaviorPropertyType
} from "./script/ScenePropertyValue.ts";

export type { ComponentClass } from "./types.ts";
