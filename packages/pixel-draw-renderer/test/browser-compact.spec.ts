// Import Node.js Dependencies
import assert from "node:assert";
import path from "node:path";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoints = [
  path.join(kSrcDir, "PixelArtCanvas.ts"),
  path.join(kSrcDir, "network", "client.ts")
];

describe("Network client browser compatibility", () => {
  for (const entryPoint of kEntryPoints) {
    const entryName = path.relative(kSrcDir, entryPoint);

    it(`should bundle '${entryName}' for a browser target with no Node.js builtins`, async() => {
      try {
        await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          write: false,
          platform: "browser",
          external: [],
          logLevel: "silent"
        });
      }
      catch (error: any) {
        const reasons = (error.errors ?? [])
          .map((buildError: esbuild.Message) => buildError.text)
          .join("\n");

        assert.fail(
          `'${entryName}' is not browser-compatible (it cannot be bundled for a "browser" platform):\n${reasons || error.message}`
        );
      }
    });
  }
});
