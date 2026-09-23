// Import Node.js Dependencies
import assert from "node:assert";
import path from "node:path";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
const kNetworkSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoints = [
  path.join(kNetworkSrcDir, "client", "index.ts"),
  path.join(kNetworkSrcDir, "index.ts"),
  path.join(kNetworkSrcDir, "transport", "loopback.ts"),
  path.join(kNetworkSrcDir, "transport", "channel.ts")
];

describe("Network browser compatibility", () => {
  for (const entryPoint of kEntryPoints) {
    const entryName = path.relative(kNetworkSrcDir, entryPoint);

    it(`should bundle '${entryName}' for a browser target with no Node.js builtins`, async() => {
      try {
        const result = await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          metafile: true,
          write: false,
          platform: "browser",
          external: [],
          logLevel: "silent"
        });
        const inputs = Object.keys(result.metafile.inputs);
        const nodeOnlyPaths = [
          "server/auth/password",
          "server/auth/providers/PasswordAuthentication",
          "server/extension/worker/"
        ];
        assert.equal(inputs.some((input) => nodeOnlyPaths.some(
          (nodeOnlyPath) => input.includes(nodeOnlyPath)
        )), false);
      }
      catch (error: any) {
        const reasons = (error.errors ?? [])
          .map((buildError: esbuild.Message) => buildError.text)
          .join("\n");

        assert.fail(
          `'${entryName}' is not browser-compatible `
          + `(it cannot be bundled for a "browser" platform):\n${reasons || error.message}`
        );
      }
    });
  }
});
