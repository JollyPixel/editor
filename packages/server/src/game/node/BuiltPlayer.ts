// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { GamePlayerError } from "../errors/GamePlayerError.ts";
import type {
  GamePlayer,
  PlayerBundle,
  PlayerPageSource
} from "../GamePlayer.ts";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH
} from "../../editors/EditorDescriptor.ts";
import { PlayerPage } from "../PlayerPage.ts";

// CONSTANTS
const kBuildManifest = path.join(".vite", "manifest.json");
const kBuildManifestSchema = z.record(z.string(), z.object({
  file: z.string(),
  imports: z.array(z.string()).optional(),
  dynamicImports: z.array(z.string()).optional(),
  css: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional()
}));

type BuildManifest = z.infer<typeof kBuildManifestSchema>;

export class BuiltPlayer implements GamePlayer, PlayerPageSource {
  #directory: string;

  constructor(
    directory: string
  ) {
    this.#directory = directory;
  }

  html(): Promise<string> {
    return fs.readFile(path.join(this.#directory, PLAY_PAGE_PATH), "utf8");
  }

  async bundle(): Promise<PlayerBundle> {
    const manifest = await this.#manifest();
    const page = await this.html();
    const files = new Map<string, Uint8Array>();
    const entries = [PLAY_PAGE_PATH, ...importedEntries(manifest, page)];
    for (const file of loadedFiles(manifest, entries)) {
      files.set(file, await fs.readFile(path.join(this.#directory, file)));
    }

    return {
      page,
      files
    };
  }

  async #manifest(): Promise<BuildManifest> {
    let text: string;
    try {
      text = await fs.readFile(
        path.join(this.#directory, kBuildManifest),
        "utf8"
      );
    }
    catch (error) {
      throw new GamePlayerError(
        "the game player is not built: build the studio before exporting",
        { cause: error }
      );
    }

    return kBuildManifestSchema.parse(JSON.parse(text));
  }
}

function importedEntries(
  manifest: BuildManifest,
  page: string
): string[] {
  const imported = new Set(Object.values(PlayerPage.parse(page).imports).map(
    (url) => path.posix.join(PLAY_PAGE_DIR, url)
  ));

  return Object.keys(manifest).filter(
    (key) => imported.has(manifest[key].file)
  );
}

function loadedFiles(
  manifest: BuildManifest,
  entries: Iterable<string>
): Set<string> {
  const files = new Set<string>();
  const visited = new Set<string>();
  const pending = Array.from(entries);
  for (const key of pending) {
    const chunk = manifest[key];
    if (visited.has(key) || chunk === undefined) {
      continue;
    }

    visited.add(key);
    files.add(chunk.file);
    for (const file of [...chunk.css ?? [], ...chunk.assets ?? []]) {
      files.add(file);
    }
    pending.push(...chunk.imports ?? [], ...chunk.dynamicImports ?? []);
  }

  return files;
}
