// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

export type PreviewRevisionCatalog = Pick<
  CatalogClient,
  "record" | "dependencies"
>;

export function previewRevision(
  catalog: PreviewRevisionCatalog,
  assetId: string
): string {
  const own = catalog.record(assetId)?.revision;
  const dependencies = catalog.dependencies
    .transitiveDependencies(assetId)
    .map(({ id }) => `${id}@${catalog.record(id)?.revision ?? ""}`);

  return [own ?? "", ...dependencies].join(" ");
}
