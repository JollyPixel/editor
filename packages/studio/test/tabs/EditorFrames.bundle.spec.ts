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
const kStudioRoot = path.join(import.meta.dirname, "..", "..");
const kForbiddenModules = /\/node_modules\/(three|reflect-metadata)\//;

describe("EditorFrames bundle", () => {
  test("leaves three.js and reflect-metadata out of the shell", async() => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      root: kStudioRoot,
      build: {
        write: false,
        minify: false,
        rolldownOptions: {
          input: path.join(kStudioRoot, "src", "tabs", "EditorFrames.ts"),
          preserveEntrySignatures: "strict"
        }
      }
    }) as Rolldown.RolldownOutput;
    const moduleIds = result.output.flatMap(
      (file) => (file.type === "chunk" ? file.moduleIds : [])
    );

    assert.deepStrictEqual(
      moduleIds.filter((id) => kForbiddenModules.test(id)),
      []
    );
  });
});
