// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type { Mixed } from "../../src/field/mixed.ts";

test("Mixed keeps a unique symbol type, so FieldValue does not collapse to a bare symbol", () => {
  expect<typeof Mixed>().type.not.toBe<symbol>();
});
