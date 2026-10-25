// Import Third-party Dependencies
import type {
  AssetReferenceData,
  AssetType
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import type { Component } from "../../../components/types.ts";
import type { JSONObject } from "./SceneFile.ts";

export type SceneMode = "edit" | "play";

export type ComponentAssetValues = Record<string, unknown>;

export type ComponentAssetTypes<TAssets extends ComponentAssetValues> = {
  readonly [TSlot in keyof TAssets]: AssetType<TAssets[TSlot]>;
};

export interface ComponentAssetResolver {
  resolve<TValue>(
    reference: AssetReferenceData,
    type: AssetType<TValue>
  ): TValue;
}

export class ComponentAssets<
  TAssets extends ComponentAssetValues = ComponentAssetValues
> {
  #types: ComponentAssetTypes<TAssets>;
  #references: Readonly<Record<string, AssetReferenceData | null>>;
  #resolver: ComponentAssetResolver;

  constructor(
    types: ComponentAssetTypes<TAssets>,
    references: Readonly<Record<string, AssetReferenceData | null>>,
    resolver: ComponentAssetResolver
  ) {
    this.#types = types;
    this.#references = references;
    this.#resolver = resolver;
  }

  resolve<TSlot extends keyof TAssets & string>(
    slot: TSlot
  ): TAssets[TSlot] | null {
    const reference = this.#references[slot] ?? null;

    return reference === null ?
      null :
      this.#resolver.resolve(reference, this.#types[slot]);
  }
}

export interface ComponentContext<
  TAssets extends ComponentAssetValues = ComponentAssetValues
> {
  readonly mode: SceneMode;
  readonly assets: ComponentAssets<TAssets>;
}

export interface ComponentDefinition<
  TData = unknown,
  TComponent extends Component = Component,
  TAssets extends ComponentAssetValues = ComponentAssetValues
> {
  readonly type: string;
  readonly assets?: ComponentAssetTypes<TAssets>;

  parse(
    data: Readonly<JSONObject>
  ): TData;
  create(
    actor: Actor<any>,
    data: TData,
    context: ComponentContext<TAssets>
  ): TComponent | null;
  apply?(
    component: TComponent,
    data: TData
  ): void;
}
