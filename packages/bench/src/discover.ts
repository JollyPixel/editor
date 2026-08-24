// Import Node.js Dependencies
import { globSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import Internal Dependencies
import { BenchmarkError } from "./errors/index.ts";
import type { BenchmarkSuite } from "./suite.ts";

// CONSTANTS
const kDefaultPattern = "bench/**/*.bench.ts";

export interface DiscoverOptions {
  cwd?: string;
  pattern?: string;
  /**
   * Path substrings to exclude; a bare file name is enough.
   */
  ignore?: string[];
  /**
   * Path substrings to include; empty includes every file.
   */
  filters?: string[];
}

/**
 * Lists sorted benchmark paths relative to `cwd`, using forward slashes.
 */
export function discover(
  options: DiscoverOptions = {}
): string[] {
  const {
    cwd = process.cwd(),
    pattern = kDefaultPattern,
    ignore = [],
    filters = []
  } = options;

  const files = globSync(pattern, { cwd })
    .map((file) => file.split(path.sep).join("/"))
    .sort();

  return files.filter(
    (file) => !matches(file, ignore) &&
      (filters.length === 0 || matches(file, filters))
  );
}

export async function loadSuite(
  file: string,
  cwd = process.cwd()
): Promise<BenchmarkSuite> {
  const href = pathToFileURL(path.resolve(cwd, file)).href;
  // Keep the dynamic import unknown until isSuite() validates it.
  const { default: suite }: { default: unknown; } = await import(href);

  if (!isSuite(suite)) {
    throw new BenchmarkError(
      `${file} must default-export a suite created with defineSuite()`
    );
  }

  return suite;
}

function isSuite(
  value: unknown
): value is BenchmarkSuite {
  return typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "name") === "string" &&
    typeof Reflect.get(value, "run") === "function";
}

function matches(
  file: string,
  needles: string[]
): boolean {
  const haystack = file.toLowerCase();

  return needles.some(
    (needle) => haystack.includes(needle.toLowerCase())
  );
}
