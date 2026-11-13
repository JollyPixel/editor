// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/client";

export interface ModelDependencies {
  listDependencies(
    assetId: string
  ): readonly AssetReferenceData[];
}

export function linkedTextureId(
  dependencies: ModelDependencies,
  modelId: string
): string {
  const reference = dependencies
    .listDependencies(modelId)
    .find((dependency) => dependency.kind === PIXEL_ART_KIND);
  if (reference === undefined) {
    throw new Error(`The voxel model "${modelId}" has no pixel-art texture.`);
  }

  return reference.id;
}
