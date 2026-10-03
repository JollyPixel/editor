// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtFeatures } from "../../page/scripts/PixelArtFeatures.ts";

describe("PixelArtFeatures", () => {
  test("runtime=off and empty turn the preview and starter region off", () => {
    const features = PixelArtFeatures.playground.withQuery("?runtime=off&empty");

    assert.equal(features.preview, false);
    assert.equal(features.starterRegion, false);
  });

  test("query params never turn on a feature the profile leaves off", () => {
    const features = PixelArtFeatures.editor.withQuery("?runtime=on");

    assert.equal(features.preview, false);
  });

  test("import-policy overrides the profile only with a known policy", () => {
    const { playground } = PixelArtFeatures;

    assert.equal(playground.withQuery("?import-policy=add").importPolicy, "add");
    assert.equal(playground.withQuery("?import-policy=nope").importPolicy, "ask");
  });

  test("add-delay keeps only positive finite delays", () => {
    const { playground } = PixelArtFeatures;

    assert.equal(playground.withQuery("?add-delay=1500").addDelay, 1500);
    assert.equal(playground.withQuery("?add-delay=-5").addDelay, 0);
    assert.equal(playground.withQuery("?add-delay=abc").addDelay, 0);
  });
});
