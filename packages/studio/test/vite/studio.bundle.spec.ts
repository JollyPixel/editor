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

function threeChunks(
  closure: Iterable<Rolldown.OutputChunk>
): string[] {
  return Array.from(closure)
    .filter((chunk) => chunk.moduleIds.some((id) => kThreeCore.test(id)))
    .map((chunk) => chunk.fileName);
}

describe("@jolly-pixel/studio bundle", () => {
  let chunks: Map<string, Rolldown.OutputChunk>;

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
  });

  test("compiles the editor pages with the shell into shared chunks", () => {
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry);
    const eager = new Map(entries.map((entry) => {
      const closure = new Set([entry]);
      for (const chunk of closure) {
        for (const name of chunk.imports) {
          closure.add(chunks.get(name)!);
        }
      }

      return [entry.name, closure];
    }));
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

  test("ships without ata-validator", () => {
    assert.deepStrictEqual(
      [...chunks.values()]
        .flatMap((chunk) => chunk.moduleIds)
        .filter((id) => kAtaValidator.test(id)),
      []
    );
  });
});
