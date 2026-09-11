// Import Node.js Dependencies
import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * CONSTANTS
 * Static `import`/`export ... from "..."`, excluding the type-only forms which are erased at compile time.
 */
const kStaticSpecifier = /^\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;

/**
 * Walks the eagerly-evaluated module graph, i.e. every module a bare
 * `import "@jolly-pixel/event-store"` forces the runtime to evaluate.
 * Dynamic `import()` and type-only imports are deliberately not followed.
 */
export function eagerGraph(
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
    const specifiers = [
      ...source.matchAll(kStaticSpecifier)
    ].map(([, specifier]) => specifier);
    graph.set(file, specifiers);

    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        queue.push(
          path.resolve(path.dirname(file), specifier)
        );
      }
    }
  }

  return graph;
}
