// Import Node.js Dependencies
import path from "node:path";

// CONSTANTS
export const FIXTURE_ROOT = path.posix.join(
  import.meta.dirname.replaceAll("\\", "/"),
  "..",
  "fixtures",
  "workspace"
);
export const FIXTURE_PAGE = path.posix.join(FIXTURE_ROOT, "index.html");
export const MAIN_MODULE = "virtual:fixture/main";
export const HANDLERS_MODULE = "virtual:fixture/handlers";

export const VIRTUAL_MODULES: Record<string, string> = {
  [MAIN_MODULE]: [
    "import type { Types } from \"@jolly-pixel/types-only\";",
    "import { type Specifier } from \"@jolly-pixel/type-specifier\";",
    "import \"/feature.js\";",
    `import "${HANDLERS_MODULE}";`,
    "import \"lit\";",
    "export * from \"@jolly-pixel/reexported\";",
    "export type { Reexport } from \"@jolly-pixel/type-reexport\";",
    "void import(\"@jolly-pixel/lazy\");"
  ].join("\n"),
  [HANDLERS_MODULE]: "import \"@jolly-pixel/handlers\";"
};

export const EXPECTED_ENTRIES = [
  "@jolly-pixel/feature",
  "@jolly-pixel/handlers",
  "@jolly-pixel/lazy",
  "@jolly-pixel/reexported",
  "@jolly-pixel/type-specifier"
];
