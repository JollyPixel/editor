// Import Node.js Dependencies
import {
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kStudioRoot = path.join(import.meta.dirname, "..", "..");
const kThreeCore = /[\\/]three[\\/]build[\\/]three\.core\.js$/;
const kAtaValidator = /[\\/]ata-validator[\\/]/;
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

function threeChunks(
  closure: Iterable<Rolldown.OutputChunk>
): string[] {
  return Array.from(closure)
    .filter((chunk) => chunk.moduleIds.some((id) => kThreeCore.test(id)))
    .map((chunk) => chunk.fileName);
}

describe("@jolly-pixel/studio bundle", () => {
  let chunks: Map<string, Rolldown.OutputChunk>;
  let eager: Map<string, Set<Rolldown.OutputChunk>>;

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
    assert.strictEqual(threeChunks(eager.get("voxel-map")!).length, 1);
    assert.deepStrictEqual(
      threeChunks(eager.get("voxel-map")!),
      threeChunks(eager.get("voxel-model")!)
    );
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
