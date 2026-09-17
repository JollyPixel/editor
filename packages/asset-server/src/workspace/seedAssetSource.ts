// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  CatalogIdentitySidecar,
  type IdentityEntry
} from "../catalog/CatalogIdentitySidecar.ts";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;

export interface AssetSeedEntry {
  id: string;
  kind: string;
  content: AssetSeedFactory;
}

export type AssetSeedMap = Record<string, AssetSeedFactory | AssetSeedEntry>;

interface NormalizedSeed {
  content: AssetSeedFactory;
  identity: Omit<IdentityEntry, "path"> | null;
}

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap
): Promise<string[]> {
  const written: string[] = [];
  const identities: IdentityEntry[] = [];

  for (const [assetPath, value] of Object.entries(seed)) {
    const { content, identity } = normalizeSeed(value);
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
    const sidecar = await CatalogIdentitySidecar.load(source);
    for (const identity of identities) {
      sidecar.set(identity);
    }
    await sidecar.save(source);
  }

  return written;
}

function normalizeSeed(
  value: AssetSeedFactory | AssetSeedEntry
): NormalizedSeed {
  if (typeof value === "function") {
    return {
      content: value,
      identity: null
    };
  }

  return {
    content: value.content,
    identity: {
      id: value.id,
      kind: value.kind
    }
  };
}
