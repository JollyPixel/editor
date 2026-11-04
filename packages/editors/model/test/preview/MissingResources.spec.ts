// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MissingResources } from "#src/preview/MissingResources.ts";

describe("MissingResources", () => {
  test("replaces files outside the model with a blank image and names them", () => {
    const resources = new MissingResources();

    const textures = [
      resources.manager.resolveURL("textures/Skin%20Base.png"),
      resources.manager.resolveURL("C:\\art\\eyes.tga"),
      resources.manager.resolveURL("textures/Skin%20Base.png")
    ];

    assert.ok(textures.every((url) => url.startsWith("data:image/png;base64,")));
    assert.deepEqual(resources.names, ["Skin Base.png", "eyes.tga"]);
  });

  test("keeps the data and blob URLs a file embeds", () => {
    const resources = new MissingResources();

    assert.deepEqual(
      [
        resources.manager.resolveURL("blob:abc"),
        resources.manager.resolveURL("data:image/png;base64,AA")
      ],
      ["blob:abc", "data:image/png;base64,AA"]
    );
    assert.deepEqual(resources.names, []);
  });
});
