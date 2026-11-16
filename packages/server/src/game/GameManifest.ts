// Import Third-party Dependencies
import * as z from "zod";
import {
  AssetCatalog,
  type AssetManifestData,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  SCRIPT_KIND,
  ScriptModules
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  GameModule,
  moduleUrl
} from "./GameModule.ts";
import {
  physicsSectionSchema,
  type PhysicsSection
} from "../project/ProjectSections.ts";

// CONSTANTS
export const GAME_MANIFEST_VERSION = 1;
export const SCENE_KIND = "scene";
export const CURRENT_REVISION = "current";
export const GAME_MANIFEST_FILE = "game.json";
export const GAME_MANIFEST_META = "jolly-game";
const kBuildsDir = "builds";

export interface ArtifactPath {
  /**
   * Path of the build in an exported game, from its root.
   */
  readonly file: string;
  /**
   * URL of the build, relative to `game.json`.
   */
  readonly url: string;
}

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
      (record) => [record.id.value, artifactPath(record).url]
    )),
    physics
  };
}

export function scriptImports(
  records: Iterable<AssetRecord>,
  base: string
): Record<string, string> {
  const imports: Record<string, string> = {};
  for (const [specifier, script] of new ScriptModules(records).entries()) {
    imports[`${base}${moduleUrl(specifier)}`] = `${base}${artifactPath(script).url}`;
  }

  return imports;
}

export function artifactPath(
  record: AssetRecord
): ArtifactPath {
  const revision = record.revision ?? CURRENT_REVISION;
  if (record.hasKind(SCRIPT_KIND)) {
    const module = new GameModule(record.path.value);

    return {
      file: module.file,
      url: module.url(revision)
    };
  }

  const { name, extension } = record.path;
  const segments = [
    kBuildsDir,
    record.id.value,
    revision,
    `${name}${extension}`
  ];

  return {
    file: segments.join("/"),
    url: segments.map(encodeURIComponent).join("/")
  };
}
