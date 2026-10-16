// Import Internal Dependencies
import {
  STUDIO_ROOT,
  StudioProject
} from "../../server/project/StudioProject.ts";
import {
  MAP,
  MODEL,
  TEXTURE
} from "../../test/e2e/support/assets.ts";
import {
  MAP_TAB,
  TEXTURE_TAB
} from "../../test/e2e/support/tabs.ts";

// CONSTANTS
const kOpenTargets = new Map([
  ["voxel-map", { row: MAP, tab: MAP_TAB }],
  ["voxel-model", { row: MODEL, tab: "model" }],
  ["pixel-art", { row: TEXTURE, tab: TEXTURE_TAB }]
]);

export interface BenchEditor {
  name: string;
  row: string;
  tab: string;
  dist: string;
}

export class BenchEditors implements Iterable<BenchEditor> {
  readonly #byName: ReadonlyMap<string, BenchEditor>;

  static async read(): Promise<BenchEditors> {
    const project = await StudioProject.open(
      StudioProject.resolveRoot(STUDIO_ROOT),
      { inMemory: true }
    );
    const editors: BenchEditor[] = [];
    for (const { name, dist } of project.editors) {
      const target = kOpenTargets.get(name);
      if (target !== undefined) {
        editors.push({
          name,
          dist,
          ...target
        });
      }
    }

    return new BenchEditors(editors);
  }

  constructor(
    editors: Iterable<BenchEditor>
  ) {
    this.#byName = new Map(
      Array.from(editors, (editor) => [editor.name, editor])
    );
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

  servingUrl(
    url: string
  ): BenchEditor | null {
    const name = /\/editors\/([\w-]+)\//.exec(url)?.[1];

    return name === undefined ? null : this.#byName.get(name) ?? null;
  }
}
