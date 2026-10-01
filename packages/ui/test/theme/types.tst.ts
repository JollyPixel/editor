// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  Density,
  DENSITIES,
  ThemeMode,
  THEME_MODES
} from "../../src/theme/types.ts";

test("ThemeMode and Density are the unions of their constants", () => {
  expect<ThemeMode>().type.toBe<"light" | "dark" | "auto">();
  expect<Density>().type.toBe<"compact" | "default" | "comfortable">();
});

test("the constants are read-only", () => {
  expect<typeof THEME_MODES>().type.toBe<readonly ["light", "dark", "auto"]>();
  expect<typeof DENSITIES>().type.toBe<readonly ["compact", "default", "comfortable"]>();
});
