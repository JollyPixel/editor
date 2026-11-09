// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { GamePlayerError } from "./errors/GamePlayerError.ts";
import {
  EDITOR_PAGE_FILE,
  PLAY_PAGE_PATH
} from "../../shared/EditorDescriptor.ts";
import { GAME_MANIFEST_META } from "../../shared/GameManifest.ts";

// CONSTANTS
const kBuildManifest = path.join(".vite", "manifest.json");
const kParentReference = /\b(src|href)="\.\.\//g;
const kHeadEnd = "</head>";
const kGameMeta = `<meta name="${GAME_MANIFEST_META}" content="exported">`;
const kBuildManifestSchema = z.record(z.string(), z.object({
  file: z.string(),
  imports: z.array(z.string()).optional(),
  dynamicImports: z.array(z.string()).optional(),
  css: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional()
}));

type BuildManifest = z.infer<typeof kBuildManifestSchema>;

export interface GamePlayer {
  files(): Promise<Map<string, Uint8Array>>;
}

export class BuiltPlayer implements GamePlayer {
  #directory: string;

  constructor(
    directory: string
  ) {
    this.#directory = directory;
  }

  async files(): Promise<Map<string, Uint8Array>> {
    const manifest = await this.#manifest();
    const page = await fs.readFile(
      path.join(this.#directory, PLAY_PAGE_PATH),
      "utf8"
    );
    const files = new Map<string, Uint8Array>([
      [EDITOR_PAGE_FILE, new TextEncoder().encode(exportedPage(page))]
    ]);
    for (const file of loadedFiles(manifest, PLAY_PAGE_PATH)) {
      files.set(file, await fs.readFile(path.join(this.#directory, file)));
    }

    return files;
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

function exportedPage(
  page: string
): string {
  if (page.search(kParentReference) === -1 || !page.includes(kHeadEnd)) {
    throw new GamePlayerError(
      `the built ${PLAY_PAGE_PATH} loads nothing from ../ or has no ${kHeadEnd}`
    );
  }

  return page
    .replace(kParentReference, "$1=\"./")
    .replace(kHeadEnd, `  ${kGameMeta}\n${kHeadEnd}`);
}

function loadedFiles(
  manifest: BuildManifest,
  entry: string
): Set<string> {
  const files = new Set<string>();
  const visited = new Set<string>();
  const pending = [entry];
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
