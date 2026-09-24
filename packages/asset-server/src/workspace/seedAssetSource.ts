// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  IdentitySidecar,
  type IdentityEntry
} from "../identity/IdentitySidecar.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";

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
  handlers?: Iterable<AssetKindHandler>;
}

interface NormalizedSeed {
  content: AssetSeedFactory;
  identity: Omit<IdentityEntry, "path"> | null;
}

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap,
  options: SeedAssetSourceOptions = {}
): Promise<string[]> {
  const registry = new AssetKindRegistry(options.handlers);
  const written: string[] = [];
  const identities: IdentityEntry[] = [];

  for (const [assetPath, value] of Object.entries(seed)) {
    const { content, identity } = normalizeSeed(value, registry);
    if (
      await source.exists(assetPath) ||
      !await source.writeIfAbsent(assetPath, await content())
    ) {
      continue;
    }

    written.push(assetPath);
    if (identity !== null) {
      identities.push({
        ...identity,
        path: assetPath
      });
    }
  }

  if (identities.length > 0) {
    const sidecar = await IdentitySidecar.load(source);
    for (const identity of identities) {
      sidecar.set(identity);
    }
    await sidecar.save();
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
      identity: null
    };
  }

  return {
    content: value.content ?? defaultContent(value, registry),
    identity: {
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
