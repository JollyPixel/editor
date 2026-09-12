// Import Third-party Dependencies
import { expect, test } from "tstyche";

// Import Internal Dependencies
import {
  BlockSurface,
  type BlockSurfaceOptions,
  type BlockDefinition
} from "../../src/index.ts";

test("block surfaces expose explicit alpha modes without the legacy flag", () => {
  expect<keyof BlockSurfaceOptions>().type.not.toBeAssignableFrom<"transparent">();
  expect<keyof BlockDefinition>().type.not.toBeAssignableFrom<"transparent">();
  expect(BlockSurface).type.toBeConstructableWith({
    alphaMode: "mask", side: "double", alphaCutoff: 0.5
  });
  expect(BlockSurface).type.not.toBeConstructableWith({ alphaMode: "cutout" });
  expect(BlockSurface).type.not.toBeConstructableWith({ side: "back" });
  expect(BlockSurface).type.not.toBeConstructableWith({ transparent: true });
});
