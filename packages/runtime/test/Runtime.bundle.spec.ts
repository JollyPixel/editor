// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kRuntimeRoot = path.join(import.meta.dirname, "..");
const kOnDemandModules =
  /\/(KTX2Loader|GLTFLoader|FBXLoader|OBJLoader|MTLLoader|meshopt_decoder\.module)\.js$/;

function bundle(
  entry: string
): Promise<Rolldown.RolldownOutput> {
  return build({
    configFile: false,
    logLevel: "silent",
    root: kRuntimeRoot,
    build: {
      write: false,
      minify: false,
      rolldownOptions: {
        input: path.join(kRuntimeRoot, "src", entry),
        preserveEntrySignatures: "strict"
      }
    }
  }) as Promise<Rolldown.RolldownOutput>;
}

describe("@jolly-pixel/runtime bundle", () => {
  test("keeps three.js and the engine out of the core entry", async() => {
    const result = await bundle("core/index.ts");
    const moduleIds = result.output.flatMap(
      (file) => (file.type === "chunk" ? file.moduleIds : [])
    );

    assert.deepStrictEqual(
      moduleIds.filter(
        (id) => /[\\/](three|engine)[\\/]/.test(id)
      ),
      []
    );
  });

  test("loads the three.js texture and model loaders on demand", async() => {
    const result = await bundle("index.ts");
    const chunks = new Map(
      result.output.flatMap(
        (file) => (file.type === "chunk" ? [[file.fileName, file]] : [])
      )
    );
    const eager = new Set(
      [...chunks.values()].filter((chunk) => chunk.isEntry)
    );
    for (const chunk of eager) {
      for (const name of chunk.imports) {
        eager.add(chunks.get(name)!);
      }
    }
    const moduleIds = [...chunks.values()].flatMap((chunk) => chunk.moduleIds);

    assert.deepStrictEqual(
      [...eager]
        .flatMap((chunk) => chunk.moduleIds)
        .filter((id) => kOnDemandModules.test(id)),
      []
    );
    assert.equal(
      moduleIds.filter((id) => kOnDemandModules.test(id)).length,
      6
    );
  });
});
