// Import Third-party Dependencies
import type {
  AssetReferenceData,
  AssetType
} from "@jolly-pixel/asset";
import type {
  SceneAssetContext,
  SceneAssetResolver
} from "@jolly-pixel/editor.host/scene";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { SceneComponents } from "../components/SceneComponents.ts";

export class EditAssets implements Systems.ComponentAssetResolver {
  #components: Pick<SceneComponents, "assetSource">;
  #session: SceneAssetContext;
  #resolvers = new Map<string, SceneAssetResolver>();

  constructor(
    components: Pick<SceneComponents, "assetSource">,
    session: SceneAssetContext
  ) {
    this.#components = components;
    this.#session = session;
  }

  resolve<TValue>(
    reference: AssetReferenceData,
    type: AssetType<TValue>
  ): TValue {
    return this.#resolver(type.kind.value).resolve(reference) as TValue;
  }

  dispose(): void {
    for (const resolver of this.#resolvers.values()) {
      resolver.dispose();
    }
    this.#resolvers.clear();
  }

  #resolver(
    kind: string
  ): SceneAssetResolver {
    let resolver = this.#resolvers.get(kind);
    if (resolver === undefined) {
      const source = this.#components.assetSource(kind);
      if (source === undefined) {
        throw new Error(
          `EditAssets: the scene editor resolves no "${kind}" asset.`
        );
      }
      resolver = source.open(this.#session);
      this.#resolvers.set(kind, resolver);
    }

    return resolver;
  }
}
