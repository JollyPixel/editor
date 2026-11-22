// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type {
  SignalEvent,
  Systems
} from "@jolly-pixel/ecs";

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
   * Name of a registered `@jolly-pixel/ui` icon. Without it, the kind shows
   * the icon of its first asset kind that has one.
   */
  icon?: string;
  form: ComponentForm<TData, TAssets>;
  /**
   * `definition.assets` slots the scene editor leaves empty when it adds a
   * component, instead of asking for an asset. They name no icon either.
   */
  optionalAssets?: readonly (keyof TAssets & string)[];
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
   * Signals a component of this kind emits and methods a connection can call.
   */
  signals?: ComponentSignalsDescriber<TData, TAssets>;
  /**
   * Where the actor origin sits on the rendered content. `"corner"` when the
   * content grows from the origin toward the positive axes.
   * @default "center"
   */
  origin?: SceneComponentOrigin;
}

export type SceneComponentOrigin = "center" | "corner";

export interface DeclaredParameter {
  name: string;
  /**
   * Type as written in the source, `""` when it has none.
   */
  type: string;
}

export interface DeclaredMember {
  /**
   * Name of the field holding the `SignalEvent`, or of the method.
   */
  key: string;
  params: readonly DeclaredParameter[];
}

export interface ComponentSignals {
  signals: readonly DeclaredMember[];
  methods: readonly DeclaredMember[];
}

export type SignalKey<TComponent> = {
  [TKey in keyof TComponent]: TComponent[TKey] extends SignalEvent<any> ?
    TKey :
    never;
}[keyof TComponent] & string;

export type ComponentSignalsDescriber<
  TData extends object = any,
  TAssets extends Systems.ComponentAssetValues = any
> = (
  data: TData,
  assets: Systems.ComponentAssets<TAssets>
) => ComponentSignals | null;

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
  ready?(
    reference: AssetReferenceData
  ): Promise<void>;
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
