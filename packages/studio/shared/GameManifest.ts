// Import Third-party Dependencies
import * as z from "zod";
import {
  AssetCatalog,
  AssetRecord,
  type AssetManifestData
} from "@jolly-pixel/asset";

// CONSTANTS
export const GAME_MANIFEST_VERSION = 1;
export const SCENE_KIND = "scene";
export const CURRENT_REVISION = "current";

export interface GameManifestData {
  readonly version: typeof GAME_MANIFEST_VERSION;
  readonly start: string;
  readonly assets: AssetManifestData;
}

export const gameManifestSchema = z.object({
  version: z.literal(GAME_MANIFEST_VERSION),
  start: z.string().min(1),
  assets: z.unknown().transform((assets) => AssetCatalog.parse(assets))
});

export function gameManifest(
  start: string,
  records: Iterable<AssetRecord>
): GameManifestData {
  const built = Array.from(records, (record) => new AssetRecord({
    ...record.toJSON(),
    path: artifactPath(record)
  }));

  return {
    version: GAME_MANIFEST_VERSION,
    start,
    assets: new AssetCatalog(built).toJSON()
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
