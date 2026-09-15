// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isTextureImportPolicy,
  nextActiveTextureId,
  suggestTextureName,
  textureCanvasOptions
} from "../../../src/ui/pixel-draw-panel/textures.ts";

describe("isTextureImportPolicy", () => {
  test("accepts the three policies", () => {
    assert.equal(isTextureImportPolicy("replace"), true);
    assert.equal(isTextureImportPolicy("add"), true);
    assert.equal(isTextureImportPolicy("ask"), true);
  });

  test("rejects anything else", () => {
    assert.equal(isTextureImportPolicy(""), false);
    assert.equal(isTextureImportPolicy("Ask"), false);
  });
});

describe("suggestTextureName", () => {
  test("drops the extension", () => {
    assert.equal(suggestTextureName("grass_tiles.png"), "grass_tiles");
  });

  test("keeps inner dots and drops only the last extension", () => {
    assert.equal(suggestTextureName("hero.walk.webp"), "hero.walk");
  });

  test("drops any directory part", () => {
    assert.equal(suggestTextureName("sprites/hero.png"), "hero");
    assert.equal(suggestTextureName("C:\\art\\hero.png"), "hero");
  });

  test("keeps dotfiles and names without extension", () => {
    assert.equal(suggestTextureName(".hidden"), ".hidden");
    assert.equal(suggestTextureName("stone"), "stone");
  });

  test("falls back to Texture for an empty name", () => {
    assert.equal(suggestTextureName(""), "Texture");
  });
});

describe("nextActiveTextureId", () => {
  const ids = ["a", "b", "c"];

  test("keeps the active id when another texture is removed", () => {
    assert.equal(nextActiveTextureId(ids, "a", "b"), "b");
  });

  test("moves to the right neighbour", () => {
    assert.equal(nextActiveTextureId(ids, "b", "b"), "c");
    assert.equal(nextActiveTextureId(ids, "a", "a"), "b");
  });

  test("moves to the left neighbour when the last one is removed", () => {
    assert.equal(nextActiveTextureId(ids, "c", "c"), "b");
  });

  test("returns null when nothing is left", () => {
    assert.equal(nextActiveTextureId(["a"], "a", "a"), null);
  });

  test("keeps the active id for an unknown removed id", () => {
    assert.equal(nextActiveTextureId(ids, "z", "z"), "z");
  });
});

describe("textureCanvasOptions", () => {
  test("overrides base options per top-level key", () => {
    const onDrawEnd = mock.fn();
    const options = textureCanvasOptions(
      {
        texture: { size: { x: 80, y: 80 } },
        brush: { size: 4 },
        onDrawEnd
      },
      {
        id: "grass",
        name: "grass",
        texture: { size: { x: 16 } }
      }
    );

    assert.deepEqual(options.texture, { size: { x: 16 } });
    assert.deepEqual(options.brush, { size: 4 });
    assert.equal(options.onDrawEnd, onDrawEnd);
  });

  test("strips the texture identity fields", () => {
    const options = textureCanvasOptions({}, {
      id: "grass",
      name: "Grass",
      tooltip: "textures/grass.pixelart"
    });

    assert.deepEqual(Object.keys(options), []);
  });
});
