// Import Third-party Dependencies
import * as z from "zod";
import {
  AssetCatalog,
  type AssetManifestData,
  type AssetRecord
} from "@jolly-pixel/asset";

// CONSTANTS
export const GAME_MANIFEST_VERSION = 1;
export const SCENE_KIND = "scene";
export const CURRENT_REVISION = "current";

export interface GameManifestData {
  readonly version: typeof GAME_MANIFEST_VERSION;
  readonly start: string;
  /**
   * The project's records, at their project paths.
   */
  readonly assets: AssetManifestData;
  /**
   * URL of each asset's build, relative to `game.json`, by asset ID.
   */
  readonly artifacts: Readonly<Record<string, string>>;
}

export const gameManifestSchema = z.object({
  version: z.literal(GAME_MANIFEST_VERSION),
  start: z.string().min(1),
  assets: z.unknown().transform((assets) => AssetCatalog.parse(assets)),
  artifacts: z.record(z.string(), z.string())
});

export function gameManifest(
  start: string,
  records: Iterable<AssetRecord>
): GameManifestData {
  const catalog = new AssetCatalog(records);

  return {
    version: GAME_MANIFEST_VERSION,
    start,
    assets: catalog.toJSON(),
    artifacts: Object.fromEntries(Array.from(
      catalog,
      (record) => [record.id.value, artifactPath(record)]
    ))
  };
}

function artifactPath(
  record: AssetRecord
): string {
  const { name, extension } = record.path;
  const segments = [
    record.id.value,
    record.revision ?? CURRENT_REVISION,
    `${name}${extension}`
  ].map(encodeURIComponent);

  return `builds/${segments.join("/")}`;
}
