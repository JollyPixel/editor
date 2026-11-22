// Import Node.js Dependencies
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kPackageRoot = path.join(import.meta.dirname, "..");
const kOnDemandModules =
  /\/(KTX2Loader|GLTFLoader|FBXLoader|OBJLoader|MTLLoader|meshopt_decoder\.module)\.js$/;
const kPhysicsModules = /\/physics\//;

describe("@jolly-pixel/backend.three bundle", () => {
  let chunks: Map<string, Rolldown.OutputChunk>;
  let moduleIds: string[];

  before(async() => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: kPackageRoot,
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: path.join(kPackageRoot, "src", "index.ts"),
          preserveEntrySignatures: "strict"
        }
      }
    }) as Rolldown.RolldownOutput;
    chunks = new Map(
      result.output.flatMap(
        (file) => (file.type === "chunk" ? [[file.fileName, file]] : [])
      )
    );
    moduleIds = [...chunks.values()].flatMap((chunk) => chunk.moduleIds);
  });

  test("loads the three.js texture and model loaders on demand", () => {
    const eager = new Set(
      [...chunks.values()].filter((chunk) => chunk.isEntry)
    );
    for (const chunk of eager) {
      for (const name of chunk.imports) {
        eager.add(chunks.get(name)!);
      }
    }

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

  test("keeps @jolly-pixel/physics out of the root entry", () => {
    assert.deepStrictEqual(
      moduleIds.filter((id) => kPhysicsModules.test(id)),
      []
    );
  });
});
