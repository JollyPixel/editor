// Import Third-party Dependencies
import {
  AssetReference,
  type AssetCoordinator,
  type AssetReferenceData,
  type AssetType
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ComponentAssetResolver } from "./ComponentDefinition.ts";

export class CoordinatorAssetResolver implements ComponentAssetResolver {
  #coordinator: AssetCoordinator;

  constructor(
    coordinator: AssetCoordinator
  ) {
    this.#coordinator = coordinator;
  }

  resolve<TValue>(
    reference: AssetReferenceData,
    type: AssetType<TValue>
  ): TValue {
    return this.#coordinator.get(
      AssetReference.parse(reference, type)
    );
  }
}
