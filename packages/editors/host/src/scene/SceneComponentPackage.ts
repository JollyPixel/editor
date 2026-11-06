// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { AssetDocumentKind } from "../lease/AssetLease.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type { ComponentForm } from "./FormRows.ts";
import type { SceneComponentCategory } from "./SceneComponentCategory.ts";

export interface SceneComponentKind<
  TData extends object = any,
  TAssets extends Systems.ComponentAssetValues = any
> {
  definition: Systems.ComponentDefinition<TData, any, TAssets>;
  label: string;
  /**
   * The Add component folder this kind shows in.
   */
  category: SceneComponentCategory;
  /**
   * Data a component of this kind starts with when the scene editor adds it.
   */
  initialData?: Systems.JSONObject;
  /**
   * Name of a registered `@jolly-pixel/ui` icon, used when no asset slot
   * names an asset kind with an icon.
   */
  icon?: string;
  form: ComponentForm<TData, TAssets>;
  /**
   * Names one component of this kind in the hierarchy and inspector.
   * Without it, the summary is `label` with the first named asset as detail.
   */
  describe?: ComponentDescriber<TData, TAssets>;
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

export interface SceneComponentSummary {
  label: string;
  /**
   * Muted text after the label, such as an asset name.
   */
  detail?: string;
}

export type SceneComponentAssetNames<
  TAssets extends Systems.ComponentAssetValues = any
> = {
  readonly [TSlot in keyof TAssets]?: string;
};

export type ComponentDescriber<
  TData extends object = any,
  TAssets extends Systems.ComponentAssetValues = any
> = (
  data: TData,
  assets: SceneComponentAssetNames<TAssets>
) => SceneComponentSummary;

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
  assets?: readonly SceneAssetSource[];
}
