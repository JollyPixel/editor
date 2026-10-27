// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  groupMaterialFiles,
  parseTextureName
} from "#src/features/materials/model/textureNames.ts";

describe("parseTextureName", () => {
  test("reads the map from the last word of the file name, whatever the separator and case", () => {
    const parsed = [
      "textures/Rock_Albedo.png",
      "rock-normal.jpg",
      "rock nrm.webp",
      "Rock_BaseColor.png",
      "rock_ARM.png",
      "rock.disp.png",
      "mossy_rock_height.png"
    ].map(parseTextureName);

    assert.deepEqual(parsed, [
      { base: "Rock", map: "albedo" },
      { base: "rock", map: "normal" },
      { base: "rock", map: "normal" },
      { base: "Rock", map: "albedo" },
      { base: "rock", map: "orm" },
      { base: "rock", map: "height" },
      { base: "mossy rock", map: "height" }
    ]);
  });

  test("a name without a map word, or made of the map word alone, is its own base", () => {
    assert.deepEqual(parseTextureName("grass.png"), { base: "grass", map: null });
    assert.deepEqual(parseTextureName("normal.png"), { base: "normal", map: null });
  });
});

describe("groupMaterialFiles", () => {
  test("files of one material form one group, and a file without a map word is its colour", () => {
    const groups = groupMaterialFiles([
      { name: "rock_albedo.png" },
      { name: "Rock_Normal.png" },
      { name: "grass.png" },
      { name: "rock_height.png" },
      { name: "rock_color.png" }
    ]);

    assert.deepEqual(groups.map(({ name, maps }) => [name, Object.fromEntries(
      Object.entries(maps).map(([map, file]) => [map, file.name])
    )]), [
      ["Rock", { albedo: "rock_albedo.png", normal: "Rock_Normal.png", height: "rock_height.png" }],
      ["Grass", { albedo: "grass.png" }]
    ]);
  });
});
