// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Internal Dependencies
import { eagerGraph } from "./helpers/eagerGraph.ts";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoint = path.join(kSrcDir, "index.ts");

describe("browser compatibility", () => {
  test("the entrypoint's eager module graph imports no node: builtin", () => {
    const offenders = [...eagerGraph(kEntryPoint)]
      .flatMap(([file, specifiers]) => specifiers
        .filter((specifier) => specifier.startsWith("node:"))
        .map((specifier) => `${path.relative(kSrcDir, file)} -> ${specifier}`)
      );

    assert.deepEqual(
      offenders,
      []
    );
  });

  test("the entrypoint's eager module graph excludes the sqlite persistence", () => {
    const files = [
      ...eagerGraph(kEntryPoint).keys()
    ].map((file) => path.relative(kSrcDir, file));

    assert.deepEqual(
      files.filter((file) => file.includes("sqlite")),
      []
    );
  });

  test("importing the entrypoint does not evaluate any sqlite module", async() => {
    const { persistence } = await import("#src/index.ts");

    assert.strictEqual(
      typeof persistence.sqlite,
      "function"
    );
    assert.strictEqual(
      persistence.sqlite.constructor.name,
      "AsyncFunction"
    );
  });
});
