// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import { is } from "../src/index.ts";

declare const value: unknown;
declare const text: string | null;

test("member narrows to the listed literals", () => {
  const modes = ["light", "dark"] as const;
  if (is.member(text, modes)) {
    expect(text).type.toBe<"light" | "dark">();
  }
});

test("member infers literals from an inline list", () => {
  if (is.member(value, ["a", "b"])) {
    expect(value).type.toBe<"a" | "b">();
  }
});

test("plainObject narrows unknown to a string-keyed record", () => {
  if (is.plainObject(value)) {
    expect(value).type.toBe<Record<string, unknown>>();
  }
});
