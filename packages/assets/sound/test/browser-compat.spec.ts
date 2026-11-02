// Import Node.js Dependencies
import assert from "node:assert/strict";
import path from "node:path";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");

async function bundledInputs(
  entryPoint: string
): Promise<string[]> {
  const result = await esbuild.build({
    entryPoints: [path.join(kSrcDir, entryPoint)],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    metafile: true,
    logLevel: "silent"
  });

  return Object.keys(result.metafile.inputs);
}

describe("sound browser compatibility", () => {
  test("bundles the kind package without the Node.js encoders", async() => {
    const inputPaths = await bundledInputs("index.ts");

    assert.deepEqual(
      inputPaths.filter((inputPath) => (
        inputPath.includes("@mediabunny/server") ||
        inputPath.includes("node-av")
      )),
      []
    );
  });

  test("bundles the client entry without mediabunny", async() => {
    const inputPaths = await bundledInputs(path.join("network", "client.ts"));

    assert.deepEqual(
      inputPaths.filter((inputPath) => inputPath.includes("mediabunny")),
      []
    );
  });
});
