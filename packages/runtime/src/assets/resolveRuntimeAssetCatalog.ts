// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { RuntimeAssetCatalog } from "./RuntimeAssetOptions.ts";

export async function resolveRuntimeAssetCatalog(
  input: RuntimeAssetCatalog = new AssetCatalog()
): Promise<AssetCatalog> {
  if (input instanceof AssetCatalog) {
    return input;
  }

  const response = await fetch(input);
  if (!response.ok) {
    const status = response.statusText === ""
      ? String(response.status)
      : `${response.status} ${response.statusText}`;

    throw new Error(
      `Asset catalog "${input}" responded with ${status}.`
    );
  }
  const manifest: unknown = await response.json();

  return AssetCatalog.parse(manifest);
}
