// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;

/**
 * Starter documents keyed by workspace-relative path.
 */
export type AssetSeedMap = Record<string, AssetSeedFactory>;

/**
 * Writes the starter documents of a first run so the back-end has something
 * to catalog. An existing path is never overwritten: once the workspace
 * exists it is the source of truth.
 *
 * Returns the paths written, in declaration order.
 */
export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap
): Promise<string[]> {
  const written: string[] = [];

  for (const [assetPath, build] of Object.entries(seed)) {
    if (await exists(source, assetPath)) {
      continue;
    }

    await source.write(assetPath, await build());
    written.push(assetPath);
  }

  return written;
}

async function exists(
  source: AssetSource,
  assetPath: string
): Promise<boolean> {
  try {
    await source.read(assetPath);

    return true;
  }
  catch {
    return false;
  }
}
