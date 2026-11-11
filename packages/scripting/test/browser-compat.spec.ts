// Import Node.js Dependencies
import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoints = ["index.ts", "three.ts"];

describe("scripting browser compatibility", () => {
  for (const entryPoint of kEntryPoints) {
    test(`bundles '${entryPoint}' for a browser without Node.js builtins or ts-morph`, async() => {
      const result = await esbuild.build({
        entryPoints: [path.join(kSrcDir, entryPoint)],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
        metafile: true,
        logLevel: "silent"
      });

      assert.deepEqual(
        Object.keys(result.metafile.inputs).filter((input) => input.includes("ts-morph")),
        []
      );
    });
  }
});
