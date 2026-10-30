// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { AssetDocumentKind } from "../lease/AssetLease.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type { ComponentForm } from "./FormRows.ts";

export interface SceneComponentKind<TData extends object = any> {
  definition: Systems.ComponentDefinition<TData, any, any>;
  label: string;
  /**
   * Name of a registered `@jolly-pixel/ui` icon.
   */
  icon: string;
  form: ComponentForm<TData>;
  /**
   * The `definition.assets` slot whose asset the anchor keys belong to.
   */
  anchorAsset?: string;
}

export interface SceneComponentSeed {
  type: string;
  data: Systems.JSONObject;
}

export interface SceneActorPreset {
  /**
   * Unique across every package of the scene editor.
   */
  id: string;
  label: string;
  components: readonly SceneComponentSeed[];
}

export interface SceneActorPresetGroup {
  label: string;
  presets: readonly SceneActorPreset[];
}

export type SceneActorPresetEntry = SceneActorPreset | SceneActorPresetGroup;

export interface SceneAssetResolver<TValue = unknown> {
  resolve(
    reference: AssetReferenceData
  ): TValue;
  dispose(): void;
}

export type SceneAssetContext = Pick<EditorSession, "assets" | "catalog">;

export interface SceneAssetSource<TValue = unknown> {
  /**
   * The asset kind this source opens, and the kind offered by the asset picker.
   */
  descriptor: AssetKindDescriptor;
  /**
   * Document kinds the host must know to lease the assets this source opens.
   */
  documentKinds: readonly AssetDocumentKind<unknown>[];
  open(
    session: SceneAssetContext
  ): SceneAssetResolver<TValue>;
}

export interface SceneComponentPackage {
  components: readonly SceneComponentKind[];
  /**
   * One section of the hierarchy Add menu.
   */
  presets?: readonly SceneActorPresetEntry[];
  assets?: readonly SceneAssetSource[];
}
