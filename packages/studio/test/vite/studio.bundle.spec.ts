// Import Node.js Dependencies
import {
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync
} from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kStudioRoot = path.join(import.meta.dirname, "..", "..");
const kThreeCore = /[\\/]three[\\/]build[\\/]three\.core\.js$/;
const kUiModule = /[\\/]packages[\\/]ui[\\/]dist[\\/]/;
const kAtaValidator = /[\\/]ata-validator[\\/]/;
const kPageTag = /<(jolly-[a-z0-9-]+)/g;
const kDefinedTag = /(?:customElement|customElements\.define)\("(jolly-[a-z0-9-]+)"/g;
const kHiddenAtStart = [
  /console[\\/]dist[\\/]element[\\/]index\.js$/,
  /lantern[\\/]dist[\\/]element[\\/]index\.js$/,
  /shell[\\/]settings[\\/]StudioSettings\.ts$/,
  /shell[\\/]assets[\\/]AssetDeleteDialog\.ts$/,
  /blocks[\\/]dialogs[\\/]BlockEditDialog\.ts$/,
  /blocksets[\\/]dialogs[\\/]AddBlocksetDialog\.ts$/,
  /layers[\\/]dialogs[\\/]AddLayerDialog\.ts$/,
  /shared[\\/]dialogs[\\/]NameDialog\.ts$/,
  /textures[\\/]dialogs[\\/]ImportTextureDialog\.js$/,
  /uv[\\/]nets[\\/]UvNetDialog\.js$/,
  /normal[\\/]NormalMapDock\.js$/,
  /shell[\\/]panels[\\/]LayersPanel\.ts$/,
  /shell[\\/]panels[\\/]MaterialsPanel\.ts$/,
  /animation[\\/]AnimatePanel\.ts$/,
  /material[\\/]MaterialLibrary\.ts$/
];

function chunksWith(
  closure: Iterable<Rolldown.OutputChunk>,
  pattern: RegExp
): string[] {
  return Array.from(closure)
    .filter((chunk) => chunk.moduleIds.some((id) => pattern.test(id)))
    .map((chunk) => chunk.fileName);
}

function definedTags(
  chunks: Iterable<Rolldown.OutputChunk>,
  pattern = /./
): Set<string> {
  return new Set(
    Array.from(chunks)
      .flatMap((chunk) => chunk.moduleIds)
      .filter((id) => pattern.test(id) && existsSync(id))
      .flatMap((id) => Array.from(
        readFileSync(id, "utf8").matchAll(kDefinedTag),
        (match) => match[1]
      ))
  );
}

describe("@jolly-pixel/studio bundle", () => {
  let chunks: Map<string, Rolldown.OutputChunk>;
  let eager: Map<string, Set<Rolldown.OutputChunk>>;
  let pages: Map<string, string>;

  before(async() => {
    const result = await build({
      configFile: path.join(kStudioRoot, "vite.config.ts"),
      root: kStudioRoot,
      logLevel: "silent",
      build: {
        write: false
      }
    }) as Rolldown.RolldownOutput;
    chunks = new Map(
      result.output.flatMap(
        (file) => (file.type === "chunk" ? [[file.fileName, file]] : [])
      )
    );
    eager = new Map(
      [...chunks.values()]
        .filter((chunk) => chunk.isEntry)
        .map((entry) => {
          const closure = new Set([entry]);
          for (const chunk of closure) {
            for (const name of chunk.imports) {
              closure.add(chunks.get(name)!);
            }
          }

          return [entry.name, closure];
        })
    );
    pages = new Map(
      result.output.flatMap((file) => (
        file.type === "asset" && file.fileName.endsWith("index.html") ?
          [[
            file.fileName === "index.html" ?
              "index" :
              path.basename(path.dirname(file.fileName)),
            String(file.source)
          ]] :
          []
      ))
    );
  });

  test("compiles the editor pages with the shell into shared chunks", () => {
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry);
    assert.deepStrictEqual(
      entries.map((entry) => entry.name).sort(),
      ["index", "pixel-art", "voxel-map", "voxel-model"]
    );
    for (const [name, closure] of eager) {
      assert.deepStrictEqual(
        entries
          .filter((entry) => entry.name !== name && closure.has(entry))
          .map((entry) => entry.fileName),
        [],
        `${name} loads another page's entry chunk`
      );
    }
    assert.strictEqual(chunksWith(eager.get("voxel-map")!, kThreeCore).length, 1);
    assert.deepStrictEqual(
      chunksWith(eager.get("voxel-map")!, kThreeCore),
      chunksWith(eager.get("voxel-model")!, kThreeCore)
    );
  });

  test("loads the ui every page starts with from one shared chunk", () => {
    const [shell, ...editors] = ["index", "pixel-art", "voxel-map", "voxel-model"]
      .map((name) => chunksWith(eager.get(name)!, kUiModule));

    assert.strictEqual(shell.length, 1);
    for (const editor of editors) {
      assert.deepStrictEqual(editor, shell);
    }
  });

  test("registers at start every ui element a page's HTML renders", () => {
    const uiTags = definedTags(chunks.values(), kUiModule);

    assert.deepStrictEqual([...pages.keys()].sort(), [...eager.keys()].sort());
    for (const [name, html] of pages) {
      const defined = definedTags(eager.get(name)!);
      const rendered = new Set(
        Array.from(html.matchAll(kPageTag), (match) => match[1])
      );

      assert.deepStrictEqual(
        [...rendered].filter((tag) => uiTags.has(tag) && !defined.has(tag)),
        [],
        `${name} renders an element no start module registers`
      );
    }
  });

  test("loads what the first screen does not show only on demand", () => {
    const shipped = [...chunks.values()].flatMap((chunk) => chunk.moduleIds);
    assert.deepStrictEqual(
      kHiddenAtStart.filter((pattern) => !shipped.some((id) => pattern.test(id))),
      [],
      "a hidden-at-start module is no longer in the build"
    );
    for (const [name, closure] of eager) {
      assert.deepStrictEqual(
        [...closure]
          .flatMap((chunk) => chunk.moduleIds)
          .filter((id) => kHiddenAtStart.some((pattern) => pattern.test(id)))
          .map((id) => path.basename(id)),
        [],
        `${name} loads it at start`
      );
    }
  });

  test("ships without ata-validator", () => {
    assert.deepStrictEqual(
      [...chunks.values()]
        .flatMap((chunk) => chunk.moduleIds)
        .filter((id) => kAtaValidator.test(id)),
      []
    );
  });
});
