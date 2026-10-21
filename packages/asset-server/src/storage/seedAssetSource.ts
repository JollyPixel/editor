// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetIndex,
  type IndexedAsset
} from "./AssetIndex.ts";
import type { AnyAssetKindHandler } from "../model/kinds/AssetKindHandler.ts";
import { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;

export interface AssetSeedEntry {
  id: string;
  kind: string;
  /**
   * @default the serialized `create(id)` state of the kind's handler
   */
  content?: AssetSeedFactory;
}

export type AssetSeedMap = Record<string, AssetSeedFactory | AssetSeedEntry>;

export interface SeedAssetSourceOptions {
  /**
   * Handlers that build the document of an entry without `content`.
   */
  handlers?: Iterable<AnyAssetKindHandler>;
}

interface NormalizedSeed {
  content: AssetSeedFactory;
  indexed: Omit<IndexedAsset, "path"> | null;
}

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap,
  options: SeedAssetSourceOptions = {}
): Promise<string[]> {
  const registry = new AssetKindRegistry(options.handlers);
  const written: string[] = [];
  const indexedAssets: IndexedAsset[] = [];

  for (const [assetPath, value] of Object.entries(seed)) {
    const { content, indexed } = normalizeSeed(value, registry);
    if (
      await source.exists(assetPath) ||
      !await source.writeIfAbsent(assetPath, await content())
    ) {
      continue;
    }

    written.push(assetPath);
    if (indexed !== null) {
      indexedAssets.push({
        ...indexed,
        path: assetPath
      });
    }
  }

  if (indexedAssets.length > 0) {
    const assetIndex = await AssetIndex.load(source);
    for (const indexed of indexedAssets) {
      assetIndex.set(indexed);
    }
    await assetIndex.save();
  }

  return written;
}

function normalizeSeed(
  value: AssetSeedFactory | AssetSeedEntry,
  registry: AssetKindRegistry
): NormalizedSeed {
  if (typeof value === "function") {
    return {
      content: value,
      indexed: null
    };
  }

  return {
    content: value.content ?? defaultContent(value, registry),
    indexed: {
      id: value.id,
      kind: value.kind
    }
  };
}

function defaultContent(
  entry: AssetSeedEntry,
  registry: AssetKindRegistry
): AssetSeedFactory {
  return () => {
    const handler = registry.get(entry.kind);

    return handler.serialize(handler.create(entry.id));
  };
}
