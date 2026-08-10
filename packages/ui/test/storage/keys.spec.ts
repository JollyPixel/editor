// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deriveKey,
  resolveOrder,
  slugify
} from "../../src/storage/keys.ts";

describe("Storage.slugify", () => {
  test("lowercases and joins words with a single separator", () => {
    assert.equal(slugify("Transform"), "transform");
    assert.equal(slugify("Object Layer"), "object-layer");
    assert.equal(slugify("Map   Config"), "map-config");
  });

  test("folds diacritics instead of stripping the letters they sit on", () => {
    assert.equal(
      slugify("Rotation générale"),
      "rotation-generale"
    );
    assert.equal(
      slugify("Échelle"),
      "echelle"
    );
  });

  test("gives an accented label and its unaccented spelling the same slug", () => {
    assert.equal(
      slugify("Échelle"),
      slugify("Echelle")
    );
  });

  test("trims separators produced by leading and trailing punctuation", () => {
    assert.equal(
      slugify("  Size (px)  "),
      "size-px"
    );
    assert.equal(
      slugify("--Layers--"),
      "layers"
    );
  });

  test("returns an empty string for an all punctuation label", () => {
    assert.equal(
      slugify("---"),
      ""
    );
    assert.equal(
      slugify(""),
      ""
    );
  });
});

describe("Storage.deriveKey", () => {
  test("combines tag name and label slug", () => {
    assert.equal(
      deriveKey("jolly-folder", "Transform"),
      "jolly-folder:transform"
    );
    assert.equal(
      deriveKey("jolly-vector3", "Transform"),
      "jolly-vector3:transform"
    );
  });

  test("separates two controls of different types sharing a label", () => {
    assert.notEqual(
      deriveKey("jolly-folder", "Transform"),
      deriveKey("jolly-vector3", "Transform")
    );
  });

  test("leaves the first occurrence unsuffixed and numbers the rest", () => {
    assert.equal(
      deriveKey("jolly-folder", "Options", 1),
      "jolly-folder:options"
    );
    assert.equal(
      deriveKey("jolly-folder", "Options", 2),
      "jolly-folder:options#2"
    );
    assert.equal(
      deriveKey("jolly-folder", "Options", 3),
      "jolly-folder:options#3"
    );
  });

  test("falls back to the tag name when the label carries no characters", () => {
    assert.equal(
      deriveKey("jolly-separator", ""),
      "jolly-separator"
    );
    assert.equal(
      deriveKey("jolly-separator", "---", 2),
      "jolly-separator#2"
    );
  });

  test("normalises the tag name case", () => {
    assert.equal(
      deriveKey("JOLLY-FOLDER", "Transform"),
      "jolly-folder:transform"
    );
  });
});

describe("Storage.resolveOrder", () => {
  test("keeps the stored order when the same keys are present", () => {
    assert.deepEqual(
      resolveOrder(["c", "a", "b"], ["a", "b", "c"]),
      ["c", "a", "b"]
    );
  });

  test("drops stored keys that are no longer present", () => {
    assert.deepEqual(
      resolveOrder(["c", "gone", "a"], ["a", "c"]),
      ["c", "a"]
    );
  });

  test("inserts a new key after its nearest surviving declared sibling", () => {
    assert.deepEqual(
      resolveOrder(["c", "a"], ["a", "fresh", "c"]),
      ["c", "a", "fresh"]
    );
  });

  test("inserts a new leading key at the front", () => {
    assert.deepEqual(
      resolveOrder(["c", "a"], ["fresh", "a", "c"]),
      ["fresh", "c", "a"]
    );
  });

  test("keeps consecutive new keys in their declared order", () => {
    assert.deepEqual(
      resolveOrder(["b", "a"], ["a", "one", "two", "b"]),
      ["b", "a", "one", "two"]
    );
  });

  test("returns the declared order when nothing is stored", () => {
    assert.deepEqual(
      resolveOrder([], ["a", "b", "c"]),
      ["a", "b", "c"]
    );
  });

  test("returns nothing when nothing is declared", () => {
    assert.deepEqual(
      resolveOrder(["a", "b"], []),
      []
    );
  });

  test("ignores duplicates in the stored order", () => {
    assert.deepEqual(
      resolveOrder(["a", "a", "b"], ["a", "b"]),
      ["a", "b"]
    );
  });

  test("never drops or duplicates a declared key", () => {
    const present = ["a", "b", "c", "d", "e"];
    const resolved = resolveOrder(["e", "ghost", "b"], present);

    assert.deepEqual(
      [...resolved].sort(),
      [...present].sort()
    );
  });
});
