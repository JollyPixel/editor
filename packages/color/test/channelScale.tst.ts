// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  RGBA,
  RGBA8
} from "../src/types.ts";
import { toRGBA8 } from "../src/convert/bytes.ts";

declare const unit: RGBA;
declare const byte: RGBA8;

test("object literals assign to either scale", () => {
  expect<RGBA>().type.toBeAssignableFrom({ r: 1, g: 0.4, b: 0, a: 1 });
  expect<RGBA8>().type.toBeAssignableFrom({ r: 255, g: 102, b: 0, a: 255 });
});

test("neither scale assigns to the other", () => {
  expect<RGBA8>().type.not.toBeAssignableFrom<RGBA>();
  expect<RGBA>().type.not.toBeAssignableFrom<RGBA8>();
  expect<RGBA8>().type.not.toBeAssignableFrom({ ...unit, a: 0.5 });
});

test("a byte color cannot be converted to bytes again", () => {
  expect(toRGBA8).type.toBeCallableWith(unit);
  expect(toRGBA8).type.not.toBeCallableWith(byte);
});
