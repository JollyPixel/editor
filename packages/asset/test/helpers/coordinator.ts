// Import Internal Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType,
  type AssetLoader
} from "../../src/index.ts";

// CONSTANTS
export const TEXT_ASSET = new AssetType<string>("text");

export function createCoordinator(
  load: AssetLoader<string>["load"]
): AssetCoordinator {
  return new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: "greeting",
        kind: "text",
        source: "memory:greeting"
      }),
      new AssetRecord({
        id: "farewell",
        kind: "text",
        source: "memory:farewell"
      })
    ]),
    loaders: new AssetLoaderRegistry().register(TEXT_ASSET, {
      load
    })
  });
}

export function textReference(
  id: string
): AssetReference<string> {
  return new AssetReference(id, TEXT_ASSET);
}
