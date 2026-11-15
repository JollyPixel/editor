// Import Third-party Dependencies
import * as z from "zod";
import {
  AssetCatalog,
  type AssetManifestData,
  type AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  GameModule,
  moduleUrl
} from "./GameModule.ts";
import {
  physicsSectionSchema,
  type PhysicsSection
} from "../project/api.ts";

// CONSTANTS
export const GAME_MANIFEST_VERSION = 1;
export const SCENE_KIND = "scene";
export const CURRENT_REVISION = "current";
export const GAME_MANIFEST_FILE = "game.json";
export const GAME_MANIFEST_META = "jolly-game";
const kBuildsDir = "builds";
const kScriptKind = "script";

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
  readonly physics: PhysicsSection;
}

export const gameManifestSchema = z.object({
  version: z.literal(GAME_MANIFEST_VERSION),
  start: z.string().min(1),
  assets: z.unknown().transform((assets) => AssetCatalog.parse(assets)),
  artifacts: z.record(z.string(), z.string()),
  physics: physicsSectionSchema
});

export function gameManifest(
  start: string,
  records: Iterable<AssetRecord>,
  physics: PhysicsSection
): GameManifestData {
  const catalog = new AssetCatalog(records);

  return {
    version: GAME_MANIFEST_VERSION,
    start,
    assets: catalog.toJSON(),
    artifacts: Object.fromEntries(Array.from(
      catalog,
      (record) => [record.id.value, artifactUrl(record)]
    )),
    physics
  };
}

export function scriptImports(
  records: Iterable<AssetRecord>,
  base: string
): Record<string, string> {
  const scripts = new Map<string, AssetRecord>();
  for (const record of records) {
    if (record.hasKind(kScriptKind)) {
      scripts.set(record.path.value, record);
    }
  }

  const imports: Record<string, string> = {};
  for (const [path, record] of scripts) {
    const url = `${base}${artifactUrl(record)}`;
    for (const specifier of new GameModule(path).specifiers()) {
      if (GameModule.resolve(specifier, scripts) === path) {
        imports[`${base}${moduleUrl(specifier)}`] = url;
      }
    }
  }

  return imports;
}

export function artifactSegments(
  record: AssetRecord
): string[] {
  if (record.hasKind(kScriptKind)) {
    return new GameModule(record.path.value).segments;
  }

  const { name, extension } = record.path;

  return [
    kBuildsDir,
    record.id.value,
    record.revision ?? CURRENT_REVISION,
    `${name}${extension}`
  ];
}

function artifactUrl(
  record: AssetRecord
): string {
  return record.hasKind(kScriptKind) ?
    new GameModule(record.path.value)
      .url(record.revision ?? CURRENT_REVISION) :
    artifactSegments(record).map(encodeURIComponent).join("/");
}
