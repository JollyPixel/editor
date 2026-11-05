// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { AssetDocumentKind } from "../lease/AssetLease.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type { ComponentForm } from "./FormRows.ts";
import type { SceneActorCategory } from "./SceneActorCategory.ts";

export interface SceneComponentKind<
  TData extends object = any,
  TAssets extends Systems.ComponentAssetValues = any
> {
  definition: Systems.ComponentDefinition<TData, any, TAssets>;
  label: string;
  /**
   * Name of a registered `@jolly-pixel/ui` icon, used when no asset slot
   * names an asset kind with an icon.
   */
  icon?: string;
  form: ComponentForm<TData, TAssets>;
  /**
   * The `definition.assets` slot whose asset the anchor keys belong to.
   */
  anchorAsset?: string;
  /**
   * Where the actor origin sits on the rendered content. `"corner"` when the
   * content grows from the origin toward the positive axes.
   * @default "center"
   */
  origin?: SceneComponentOrigin;
}

export type SceneComponentOrigin = "center" | "corner";

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

export interface SceneActorPresetSection {
  category: SceneActorCategory;
  presets: readonly SceneActorPreset[];
}

export interface SceneAssetResolver<TValue = unknown> {
  resolve(
    reference: AssetReferenceData
  ): TValue | null;
  dispose(): void;
}

export interface SceneAssetUpdates {
  loaded(): void;
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
    session: SceneAssetContext,
    updates: SceneAssetUpdates
  ): SceneAssetResolver<TValue>;
}

export interface SceneComponentPackage {
  components: readonly SceneComponentKind[];
  presets?: readonly SceneActorPresetSection[];
  assets?: readonly SceneAssetSource[];
}
