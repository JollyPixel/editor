// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  ResolvedRuntimeAssetOptions,
  RuntimeAssetCatalog,
  RuntimeAssetOptions
} from "./RuntimeAssetOptions.ts";

export async function resolveRuntimeAssetOptions(
  options: RuntimeAssetOptions = {}
): Promise<ResolvedRuntimeAssetOptions> {
  return {
    catalog: await resolveRuntimeAssetCatalog(options.catalog),
    loaders: options.loaders
  };
}

async function resolveRuntimeAssetCatalog(
  input: RuntimeAssetCatalog | undefined
): Promise<AssetCatalog> {
  if (input === undefined) {
    return new AssetCatalog();
  }
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
