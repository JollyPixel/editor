// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import type {
  PackageResolverOptions,
  ProjectFileOpenOptions
} from "@jolly-pixel/asset-server/node";
import {
  Project,
  ServerSettings,
  type GamePlayer,
  type ServerBackendOptions
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { STUDIO_PROJECT_FILE } from "./projectTemplate.ts";
import { SHELL_PREFERENCES } from "../shared/preferences.ts";
import { createStudioSeed } from "../shared/seed.ts";

// CONSTANTS
export const STUDIO_ROOT = path.join(import.meta.dirname, "..");
export const STUDIO_SHELL_DIR = path.join(STUDIO_ROOT, "dist");
const kPackages: PackageResolverOptions = {
  fallbacks: [STUDIO_ROOT],
  searchFolders: [
    path.join(STUDIO_ROOT, "..", "assets"),
    path.join(STUDIO_ROOT, "..", "editors")
  ]
};
const kBlocksetFile = path.join(
  STUDIO_ROOT,
  "public",
  "textures",
  "blockset.png"
);

export interface StudioProjectOptions extends ProjectFileOpenOptions {
  /**
   * @default settings.projectRoot(STUDIO_ROOT)
   */
  root?: string;
  /**
   * @default ServerSettings.parse(process.env)
   */
  settings?: ServerSettings;
}

export function openStudioProject(
  options: StudioProjectOptions = {}
): Promise<Project> {
  const {
    settings = ServerSettings.parse(process.env),
    root = settings.projectRoot(STUDIO_ROOT),
    ...fileOptions
  } = options;

  return Project.open(
    root,
    {
      ...fileOptions,
      packages: kPackages,
      template: STUDIO_PROJECT_FILE
    }
  );
}

export async function studioSeed(): Promise<AssetSeedMap> {
  return createStudioSeed(await fs.readFile(kBlocksetFile));
}

export async function studioBackendFiles(
  player: GamePlayer
): Promise<
  Pick<ServerBackendOptions, "seed" | "player" | "preferences">
> {
  return {
    seed: await studioSeed(),
    player,
    preferences: SHELL_PREFERENCES
  };
}
