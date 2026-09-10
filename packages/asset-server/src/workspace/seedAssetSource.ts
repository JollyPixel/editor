// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

export type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;
export type AssetSeedMap = Record<string, AssetSeedFactory>;

export async function seedAssetSource(
  source: AssetSource,
  seed: AssetSeedMap
): Promise<string[]> {
  const written: string[] = [];

  for (const [assetPath, build] of Object.entries(seed)) {
    if (await source.exists(assetPath)) {
      continue;
    }

    const didWrite = await source.writeIfAbsent(
      assetPath,
      await build()
    );
    if (didWrite) {
      written.push(assetPath);
    }
  }

  return written;
}
