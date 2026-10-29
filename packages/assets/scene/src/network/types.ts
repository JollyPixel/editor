// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  assetReferenceSchema,
  sceneActorSchema,
  sceneAnchorSchema,
  sceneCommandSchema,
  sceneComponentSchema,
  sceneEnvironmentPatchSchema,
  sceneEnvironmentSchema,
  sceneFogSchema,
  sceneSnapshotSchema,
  sceneTransformPatchSchema,
  sceneTransformSchema,
  vector3Schema
} from "./SceneCommand.schema.ts";

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONArray
  | JSONObject;

export interface JSONArray extends Array<JSONValue> {}

export interface JSONObject {
  [key: string]: JSONValue;
}

export type DeepReadonly<T> = T extends readonly (infer TItem)[] ?
  readonly DeepReadonly<TItem>[] :
  T extends object ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]>; } : T;

export type Vector3JSON = network.Infer<typeof vector3Schema>;
export type SceneTransformJSON = network.Infer<typeof sceneTransformSchema>;
export type SceneTransformPatch = network.Infer<typeof sceneTransformPatchSchema>;
export type SceneTransformField = keyof SceneTransformJSON;
export type AssetReferenceJSON = network.Infer<typeof assetReferenceSchema>;
export type SceneAnchorJSON = network.Infer<typeof sceneAnchorSchema>;
export type SceneComponentJSON = network.Infer<typeof sceneComponentSchema>;
export type SceneActorJSON = network.Infer<typeof sceneActorSchema>;
export type SceneActorPlacement = Pick<SceneActorJSON, "parentId" | "anchor">;
export type SceneFogJSON = network.Infer<typeof sceneFogSchema>;
export type SceneEnvironmentJSON = network.Infer<typeof sceneEnvironmentSchema>;
export type SceneEnvironmentPatch = network.Infer<typeof sceneEnvironmentPatchSchema>;
export type SceneEnvironmentField = keyof SceneEnvironmentJSON;

export type SceneTransformView = DeepReadonly<SceneTransformJSON>;
export type SceneActorView = DeepReadonly<SceneActorJSON>;
export type SceneComponentView = DeepReadonly<SceneComponentJSON>;
export type SceneEnvironmentView = DeepReadonly<SceneEnvironmentJSON>;

export type SceneCommand = network.Infer<typeof sceneCommandSchema>;
export type SceneCommandAction = SceneCommand["action"];
export type SceneNetworkCommand = SceneCommand & network.NetworkCommandHeader;
export type SceneSnapshot = network.Infer<typeof sceneSnapshotSchema>;

export type SceneServerMessage = network.NetworkServerMessage<
  SceneNetworkCommand,
  SceneSnapshot,
  AssetRoomNotice
>;

export type SceneRoom = network.Room<
  SceneNetworkCommand,
  SceneServerMessage
>;
