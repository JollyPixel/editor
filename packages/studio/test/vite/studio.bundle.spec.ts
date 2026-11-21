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
import { KIND_HANDLER_INPUT } from "@jolly-pixel/asset.common/testing";
import { PlayerPage } from "@jolly-pixel/server";
import { SCRIPT_IMPORTS } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { openStudioProject } from "../../node/studioFiles.ts";

// CONSTANTS
const kStudioRoot = path.join(import.meta.dirname, "..", "..");
const kThreeCore = /[\\/]three[\\/]build[\\/]three\.core\.js$/;
const kUiModule = /[\\/]packages[\\/]ui[\\/]dist[\\/]/;
const kPlayerModule = /[\\/]src[\\/]play[\\/]modules[\\/]/;
const kPageTag = /<(jolly-[a-z0-9-]+)/g;
const kDefinedTag = /(?:customElement|customElements\.define)\("(jolly-[a-z0-9-]+)"/g;
const kHiddenAtStart = [
  /console[\\/]dist[\\/]element[\\/]index\.js$/,
  /lantern[\\/]dist[\\/]element[\\/]index\.js$/,
  /shell[\\/]settings[\\/]StudioSettings\.ts$/,
  /shell[\\/]assets[\\/]dialogs[\\/]AssetDeleteDialog\.ts$/,
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

function isPageEntry(
  chunk: Rolldown.OutputChunk
): boolean {
  return chunk.isEntry && !kPlayerModule.test(chunk.facadeModuleId ?? "");
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

  function loadedChunks(
    entry: Rolldown.OutputChunk
  ): Set<Rolldown.OutputChunk> {
    const closure = new Set([entry]);
    for (const chunk of closure) {
      for (const name of chunk.imports) {
        closure.add(chunks.get(name)!);
      }
    }

    return closure;
  }

  let eager: Map<string, Set<Rolldown.OutputChunk>>;
  let pages: Map<string, string>;
  let editorPages: string[];

  before(async() => {
    const project = await openStudioProject();
    editorPages = Array.from(project.editors)
      .filter((editor) => editor.page.kind === "source")
      .map((editor) => editor.name);
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
        .filter(isPageEntry)
        .map((entry) => [entry.name, loadedChunks(entry)])
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
    const entries = [...chunks.values()].filter(isPageEntry);
    assert.deepStrictEqual(
      entries.map((entry) => entry.name).sort(),
      ["index", "play", "preview", "projects", ...editorPages].sort()
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
    for (const name of ["scene", "voxel-model", "preview"]) {
      assert.deepStrictEqual(
        chunksWith(eager.get(name)!, kThreeCore),
        chunksWith(eager.get("voxel-map")!, kThreeCore)
      );
    }
  });

  test("maps each module a script may import to a chunk sharing the player's three.js", () => {
    const { imports } = PlayerPage.parse(pages.get("play")!);
    const player = chunksWith(eager.get("play")!, kThreeCore);

    assert.deepStrictEqual(
      Object.keys(imports).sort(),
      Array.from(SCRIPT_IMPORTS.modules).sort()
    );
    for (const [specifier, url] of Object.entries(imports)) {
      const module = chunks.get(path.posix.join("play", url));
      assert.ok(module !== undefined, `${specifier} names no chunk`);
      assert.deepStrictEqual(
        chunksWith(loadedChunks(module), kThreeCore),
        player,
        specifier
      );
    }
  });

  test("loads the ui every page starts with from one shared chunk", () => {
    const shell = chunksWith(eager.get("index")!, kUiModule);

    assert.strictEqual(shell.length, 1);
    for (const name of editorPages) {
      assert.deepStrictEqual(chunksWith(eager.get(name)!, kUiModule), shell);
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

  test("loads kind handler code only with the offline server", () => {
    assert.ok(
      [...chunks.values()].some(
        (chunk) => chunk.moduleIds.some((id) => KIND_HANDLER_INPUT.test(id))
      ),
      "the offline server no longer ships the kind handlers"
    );
    for (const [name, closure] of eager) {
      assert.deepStrictEqual(
        chunksWith(closure, KIND_HANDLER_INPUT),
        [],
        `${name} loads kind handler code at start`
      );
    }
  });
});
