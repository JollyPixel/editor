// Import Node.js Dependencies
import { readFile } from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_ROOT
} from "../../node/studioFiles.ts";
import {
  MAP,
  MODEL,
  TEXTURE
} from "../../test/e2e/support/assets.ts";
import {
  MAP_TAB,
  TEXTURE_TAB
} from "../../test/e2e/support/tabs.ts";
import {
  fixtureContent,
  type FixtureFormat
} from "./fixtures.ts";

// CONSTANTS
const kPackagesRoot = path.join(STUDIO_ROOT, "..");
const kLargeFixtureBytes = 100 * 1024;
const kSmallFixtureBytes = 20 * 1024;
const kBenchTargets: BenchTarget[] = [
  {
    name: "voxel-map",
    page: "voxel-map",
    row: MAP,
    tab: MAP_TAB
  },
  {
    name: "voxel-model",
    page: "voxel-model",
    row: MODEL,
    tab: "model"
  },
  {
    name: "pixel-art",
    page: "pixel-art",
    row: TEXTURE,
    tab: TEXTURE_TAB
  },
  seeded({
    name: "scene",
    page: "scene",
    row: "New scene.scene.json",
    seed: created("Scene")
  }),
  seeded({
    name: "sound",
    page: "sound",
    row: "chime.ogg",
    seed: dropped(path.join("editors", "sound", "assets", "sounds", "chime.ogg"))
  }),
  seeded({
    name: "model",
    page: "model",
    row: "ToyCar.glb",
    seed: dropped(path.join("runtime", "examples", "public", "models", "ToyCar.glb"))
  }),
  seeded({
    name: "script",
    page: "script",
    row: "New script.ts",
    seed: created("Script")
  }),
  seeded({
    name: "shader",
    page: "script",
    row: "New shader.tsl.ts",
    seed: created("Shader")
  }),
  seeded({
    name: "script-ts-l",
    page: "script",
    row: "typed.ts",
    seed: generated("typescript", kLargeFixtureBytes)
  }),
  seeded({
    name: "script-js-l",
    page: "script",
    row: "plain.js",
    seed: generated("javascript", kLargeFixtureBytes)
  }),
  seeded({
    name: "text-md",
    page: "script",
    row: "notes.md",
    seed: generated("markdown", kSmallFixtureBytes)
  }),
  seeded({
    name: "text-md-l",
    page: "script",
    row: "guide.md",
    seed: generated("markdown", kLargeFixtureBytes)
  }),
  seeded({
    name: "text-json-l",
    page: "script",
    row: "data.json",
    seed: generated("json", kLargeFixtureBytes)
  })
];

export type BenchAssetSeed =
  | { kind: "new"; menuItem: string; }
  | { kind: "drop"; content(): Promise<Uint8Array>; };

interface SeededTarget {
  name: string;
  page: string;
  row: string;
  seed: BenchAssetSeed;
}

interface BenchTarget {
  name: string;
  page: string;
  row: string;
  tab: string;
  seed?: BenchAssetSeed;
}

export interface BenchEditor extends BenchTarget {
  dist: string;
}

export function benchTargetsServedBy(
  page: string
): string[] {
  return kBenchTargets
    .filter((target) => target.page === page)
    .map((target) => target.name);
}

export class BenchEditors implements Iterable<BenchEditor> {
  readonly #byName: ReadonlyMap<string, BenchEditor>;
  readonly #distByPage: ReadonlyMap<string, string>;

  static async read(): Promise<BenchEditors> {
    const project = await openStudioProject({
      inMemory: true
    });
    const dists = new Map(
      Array.from(project.editors, ({ name, dist }) => [name, dist])
    );
    const editors: BenchEditor[] = [];
    for (const target of kBenchTargets) {
      const dist = dists.get(target.page);
      if (dist !== undefined) {
        editors.push({
          ...target,
          dist
        });
      }
    }

    return new BenchEditors(editors);
  }

  constructor(
    editors: Iterable<BenchEditor>
  ) {
    const list = [...editors];
    this.#byName = new Map(list.map((editor) => [editor.name, editor]));
    this.#distByPage = new Map(list.map((editor) => [editor.page, editor.dist]));
  }

  [Symbol.iterator](): IterableIterator<BenchEditor> {
    return this.#byName.values();
  }

  select(
    names: Iterable<string>
  ): BenchEditor[] {
    return Array.from(names, (name) => {
      const editor = this.#byName.get(name);
      if (editor === undefined) {
        throw new Error(`Unknown editor "${name}"`);
      }

      return editor;
    });
  }

  distServing(
    url: string
  ): string | null {
    const page = /\/editors\/([\w-]+)\//.exec(url)?.[1];

    return page === undefined ? null : this.#distByPage.get(page) ?? null;
  }
}

function seeded(
  target: SeededTarget
): BenchTarget {
  return {
    ...target,
    tab: target.row.slice(0, target.row.indexOf("."))
  };
}

function created(
  menuItem: string
): BenchAssetSeed {
  return {
    kind: "new",
    menuItem
  };
}

function dropped(
  packageFile: string
): BenchAssetSeed {
  return {
    kind: "drop",
    content: () => readFile(path.join(kPackagesRoot, packageFile))
  };
}

function generated(
  format: FixtureFormat,
  bytes: number
): BenchAssetSeed {
  return {
    kind: "drop",
    content: () => Promise.resolve(fixtureContent(format, bytes))
  };
}
