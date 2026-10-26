// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetIndex,
  type IndexedAsset
} from "./AssetIndex.ts";
import type { AnyAssetKindHandler } from "../model/kinds/AssetKindHandler.ts";
import { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";
import { serializeAsset } from "../model/kinds/serializeAsset.ts";
import { AssetPartFiles } from "./AssetPartFiles.ts";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;

export interface AssetSeedEntry {
  id: string;
  kind: string;
  /**
   * @default the serialized `create(id)` state of the kind's handler, with
   * its part files for a kind that declares parts
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

interface SeedContent {
  data: Uint8Array;
  parts?: ReadonlyMap<string, Uint8Array>;
}

interface NormalizedSeed {
  content: () => Promise<SeedContent>;
  indexed: Omit<IndexedAsset, "path"> | null;
}

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap,
  options: SeedAssetSourceOptions = {}
): Promise<string[]> {
  const registry = new AssetKindRegistry(options.handlers);
  const partFiles = new AssetPartFiles(registry);
  const written: string[] = [];
  const indexedAssets: IndexedAsset[] = [];

  for (const [assetPath, value] of Object.entries(seed)) {
    const { content, indexed } = normalizeSeed(value, registry);
    if (await source.exists(assetPath)) {
      continue;
    }

    const { data, parts } = await content();
    if (!await source.writeIfAbsent(assetPath, data)) {
      continue;
    }

    const extension = indexed === null ? null : partFiles.extension(indexed.kind);
    if (extension !== null) {
      for (const [partId, part] of parts ?? []) {
        await source.writeIfAbsent(
          partFiles.path(assetPath, extension, partId),
          part
        );
      }
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
      content: async() => {
        return { data: await value() };
      },
      indexed: null
    };
  }

  const { content } = value;

  return {
    content: content === undefined ?
      defaultContent(value, registry) :
      async() => {
        return { data: await content() };
      },
    indexed: {
      id: value.id,
      kind: value.kind
    }
  };
}

function defaultContent(
  entry: AssetSeedEntry,
  registry: AssetKindRegistry
): () => Promise<SeedContent> {
  return async() => {
    const handler = registry.get(entry.kind);

    return serializeAsset(handler, handler.create(entry.id));
  };
}
