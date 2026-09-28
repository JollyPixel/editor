// Import Third-party Dependencies
import { expect, test } from "tstyche";

// Import Internal Dependencies
import type {
  BlockDefinition,
  FaceSlotName
} from "../../../src/index.ts";

type FaceTextures = NonNullable<BlockDefinition["faceTextures"]>;

test("face slot names are the six built-in slots", () => {
  expect<FaceSlotName>().type.toBe<
    "right" | "left" | "top" | "bottom" | "front" | "back"
  >();
});

test("faceTextures rejects a slot value that is not a tile reference", () => {
  expect<FaceTextures>().type.not.toBeAssignableFrom({
    top: "grass"
  });
});
