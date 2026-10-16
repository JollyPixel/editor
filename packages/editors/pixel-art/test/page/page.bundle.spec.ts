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
const kPixelArtRoot = path.join(import.meta.dirname, "..", "..");
const kZodModule = /\/node_modules\/zod\/v4\/(classic|mini)\//;

describe("pixel-art page bundle", () => {
  test("validates with zod/mini and leaves classic zod out", async() => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: kPixelArtRoot,
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: path.join(kPixelArtRoot, "page", "scripts", "main.ts"),
          external: [/^virtual:/]
        }
      }
    }) as Rolldown.RolldownOutput;
    const flavors = new Set(
      result.output
        .flatMap((file) => (file.type === "chunk" ? file.moduleIds : []))
        .map((id) => kZodModule.exec(id)?.[1])
        .filter((flavor) => flavor !== undefined)
    );

    assert.deepStrictEqual([...flavors], ["mini"]);
  });
});
