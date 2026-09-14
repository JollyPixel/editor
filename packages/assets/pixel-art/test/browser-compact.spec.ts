// Import Node.js Dependencies
import assert from "node:assert";
import path from "node:path";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoint = path.join(kSrcDir, "network", "client.ts");

describe("Pixel collaboration browser compatibility", () => {
  it("bundles the client entry without Node.js builtins", async() => {
    try {
      const result = await esbuild.build({
        entryPoints: [kEntryPoint],
        bundle: true,
        write: false,
        platform: "browser",
        external: [],
        metafile: true,
        logLevel: "silent"
      });
      const inputPaths = Object.keys(result.metafile.inputs);

      assert.ok(
        inputPaths.every((inputPath) => (
          !inputPath.includes("@jolly-pixel/asset-server") &&
          !inputPath.includes("@jolly-pixel/event-store")
        )),
        "The client entry loaded a server-only package"
      );
    }
    catch (error: any) {
      const reasons = (error.errors ?? [])
        .map((buildError: esbuild.Message) => buildError.text)
        .join("\n");

      assert.fail(
        "The pixel collaboration client is not browser-compatible "
        + `(it cannot be bundled for a "browser" platform):\n${reasons || error.message}`
      );
    }
  });
});
