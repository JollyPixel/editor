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
const kEntryPoint = path.join(
  import.meta.dirname,
  "..",
  "src",
  "network",
  "client.ts"
);

describe("script client browser compatibility", () => {
  test("bundles the client entry without server packages or ts-morph", async() => {
    const result = await esbuild.build({
      entryPoints: [kEntryPoint],
      bundle: true,
      write: false,
      platform: "browser",
      metafile: true,
      logLevel: "silent"
    });
    const inputPaths = Object.keys(result.metafile.inputs);

    assert.deepEqual(
      inputPaths.filter((inputPath) => (
        inputPath.includes("asset-server") ||
        inputPath.includes("event-store") ||
        inputPath.includes("ts-morph")
      )),
      []
    );
  });
});
