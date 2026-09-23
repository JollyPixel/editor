// Import Third-party Dependencies
import { expect, test } from "tstyche";

// Import Internal Dependencies
import {
  Face,
  type BlockDefinition,
  type FaceSlotName,
  type TextureSlotKey
} from "../../src/index.ts";

type FaceTextures = NonNullable<BlockDefinition["faceTextures"]>;

test("face slot names are the six built-in slots", () => {
  expect<FaceSlotName>().type.toBe<
    "right" | "left" | "top" | "bottom" | "front" | "back"
  >();
});

test("faceTextures accepts slot names, derived slots, faces and pinned slots", () => {
  expect<TextureSlotKey>().type.toBeAssignableFrom<"top.1">();
  expect<FaceTextures>().type.toBeAssignableFrom({
    top: { col: 0, row: 0 },
    "back.1": { col: 0, row: 1 },
    [Face.NegY]: { col: 0, row: 2 },
    cap: { col: 0, row: 3 }
  });
  expect<FaceTextures>().type.not.toBeAssignableFrom({
    top: "grass"
  });
});
