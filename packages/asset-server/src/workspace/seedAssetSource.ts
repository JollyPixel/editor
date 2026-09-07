// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;
export type AssetSeedMap = Record<string, AssetSeedFactory>;

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap
): Promise<string[]> {
  const written: string[] = [];

  for (const [assetPath, build] of Object.entries(seed)) {
    if (await exists(source, assetPath)) {
      continue;
    }

    await source.write(
      assetPath,
      await build()
    );
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
