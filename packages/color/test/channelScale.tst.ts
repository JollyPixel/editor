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
import { Color } from "../src/Color.ts";

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

test("a Color is a unit color and never a byte color", () => {
  expect<RGBA>().type.toBeAssignableFrom<Color>();
  expect<RGBA8>().type.not.toBeAssignableFrom<Color>();
});

test("only byte colors and strings convert from bytes", () => {
  expect(Color.fromBytes).type.toBeCallableWith(byte);
  expect(Color.fromBytes).type.toBeCallableWith("#ff6600");
  expect(Color.fromBytes).type.not.toBeCallableWith(unit);
});
