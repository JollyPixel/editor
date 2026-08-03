// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// CONSTANTS
const kSrcDir = path.join(import.meta.dirname, "..", "src");
const kEntryPoint = path.join(kSrcDir, "index.ts");
// Static `import`/`export ... from "..."`, excluding the type-only forms which are erased at compile time.
const kStaticSpecifier = /^\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;

/**
 * Walks the eagerly-evaluated module graph, i.e. every module a bare
 * `import "@jolly-pixel/event-store"` forces the runtime to evaluate.
 * Dynamic `import()` and type-only imports are deliberately not followed.
 */
function eagerGraph(
  entryPoint: string
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const queue = [entryPoint];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (graph.has(file)) {
      continue;
    }

    const source = readFileSync(file, "utf8");
    const specifiers = [...source.matchAll(kStaticSpecifier)].map(([, specifier]) => specifier);
    graph.set(file, specifiers);

    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        queue.push(path.resolve(path.dirname(file), specifier));
      }
    }
  }

  return graph;
}

describe("browser compatibility", () => {
  test("the entrypoint's eager module graph imports no node: builtin", () => {
    const offenders = [...eagerGraph(kEntryPoint)]
      .flatMap(([file, specifiers]) => specifiers
        .filter((specifier) => specifier.startsWith("node:"))
        .map((specifier) => `${path.relative(kSrcDir, file)} -> ${specifier}`)
      );

    assert.deepEqual(offenders, []);
  });

  test("the entrypoint's eager module graph excludes the sqlite persistence", () => {
    const files = [...eagerGraph(kEntryPoint).keys()]
      .map((file) => path.relative(kSrcDir, file));

    assert.deepEqual(files.filter((file) => file.includes("sqlite")), []);
  });

  test("importing the entrypoint does not evaluate any sqlite module", async() => {
    const { persistence } = await import("#src/index.ts");

    assert.strictEqual(typeof persistence.sqlite, "function");
    assert.strictEqual(persistence.sqlite.constructor.name, "AsyncFunction");
  });
});
