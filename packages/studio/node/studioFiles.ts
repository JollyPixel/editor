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
  BuiltPlayer,
  StudioProject,
  StudioServerSettings,
  type StudioBackendOptions
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
   * @default StudioServerSettings.parse(process.env)
   */
  settings?: StudioServerSettings;
}

export function openStudioProject(
  options: StudioProjectOptions = {}
): Promise<StudioProject> {
  const {
    settings = StudioServerSettings.parse(process.env),
    ...fileOptions
  } = options;

  return StudioProject.open(
    settings.projectRoot(STUDIO_ROOT),
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

export async function studioBackendFiles(): Promise<
  Pick<StudioBackendOptions, "seed" | "player" | "preferences">
> {
  return {
    seed: await studioSeed(),
    player: new BuiltPlayer(STUDIO_SHELL_DIR),
    preferences: SHELL_PREFERENCES
  };
}
