// Import Node.js Dependencies
import assert from "node:assert";
import path from "node:path";
import { describe, it } from "node:test";

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
const kServerOnly = /ata-validator|[\\/]zod[\\/]/;

describe("Scene client browser compatibility", () => {
  it("bundles the client entry without the schema compiler or zod", async() => {
    const result = await esbuild.build({
      entryPoints: [kEntryPoint],
      bundle: true,
      write: false,
      platform: "browser",
      metafile: true,
      logLevel: "silent"
    });
    const [output] = Object.values(result.metafile.outputs);
    const serverInputs = Object.entries(output.inputs)
      .filter(([inputPath, { bytesInOutput }]) => (
        kServerOnly.test(inputPath) && bytesInOutput > 0
      ))
      .map(([inputPath]) => inputPath);

    assert.deepStrictEqual(serverInputs, []);
  });
});
