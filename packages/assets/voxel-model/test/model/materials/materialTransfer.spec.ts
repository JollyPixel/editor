// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeMaterialTransfer,
  encodeMaterialTransfer
} from "#src/model/materials/materialTransfer.ts";
import { material } from "../../helpers/commands.ts";

describe("materialTransfer", () => {
  test("decodes the materials it encoded, without their place in a library", () => {
    const materials = [material("glass", "folder"), material("metal")];

    assert.deepEqual(
      decodeMaterialTransfer(encodeMaterialTransfer(materials)),
      materials.map(({ name, surface }) => {
        return {
          name,
          surface
        };
      })
    );
  });

  test("decodes any other text as null", () => {
    const texts = [
      "Glass",
      JSON.stringify({ materials: [material("glass")] }),
      encodeMaterialTransfer([
        {
          ...material("glass"),
          surface: {
            ...material("glass").surface,
            opacity: 2
          }
        }
      ])
    ];

    for (const text of texts) {
      assert.equal(decodeMaterialTransfer(text), null);
    }
  });
});
