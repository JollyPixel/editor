// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureName } from "../../src/textures/TextureName.ts";

describe("TextureName", () => {
  test("drops the extension of a file name", () => {
    assert.equal(TextureName.fromPath("grass_tiles.png").value, "grass_tiles");
  });

  test("keeps every dot but the last one", () => {
    assert.equal(TextureName.fromPath("hero.walk.webp").value, "hero.walk");
  });

  test("keeps only the base name of a POSIX or Windows path", () => {
    assert.equal(TextureName.fromPath("sprites/hero.png").value, "hero");
    assert.equal(TextureName.fromPath("C:\\art\\hero.png").value, "hero");
  });

  test("keeps dotfiles and extensionless names whole", () => {
    assert.equal(TextureName.fromPath(".hidden").value, ".hidden");
    assert.equal(TextureName.fromPath("stone").value, "stone");
  });

  test("falls back to Texture for an empty name", () => {
    assert.equal(TextureName.fromPath("").value, "Texture");
    assert.equal(new TextureName("").value, "Texture");
  });
});
