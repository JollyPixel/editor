// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelResources } from "#src/preview/ModelResources.ts";
import { FakeModelCatalog } from "../helpers/file/FakeModelCatalog.ts";

function modelResources(
  catalog = new FakeModelCatalog(),
  onStale = () => undefined
): ModelResources {
  return new ModelResources(catalog, "models/hero.fbx", onStale);
}

describe("ModelResources", () => {
  test("replaces files outside the model with a blank image and names them", () => {
    const resources = modelResources();

    const textures = [
      resources.manager.resolveURL("textures/Skin%20Base.png"),
      resources.manager.resolveURL("C:\\art\\eyes.tga"),
      resources.manager.resolveURL("textures/50%.png"),
      resources.manager.resolveURL("textures/Skin%20Base.png")
    ];

    assert.ok(textures.every((url) => url.startsWith("data:image/png;base64,")));
    assert.deepEqual(resources.names, ["Skin Base.png", "eyes.tga", "50%.png"]);
  });

  test("keeps the data and blob URLs a file embeds", () => {
    const resources = modelResources();

    assert.deepEqual(
      [
        resources.manager.resolveURL("blob:abc"),
        resources.manager.resolveURL("data:image/png;base64,AA")
      ],
      ["blob:abc", "data:image/png;base64,AA"]
    );
    assert.deepEqual(resources.names, []);
  });

  test("serves an asset beside the model once its content is fetched", async() => {
    const resources = modelResources(
      new FakeModelCatalog().add("models/textures/skin.png", new Uint8Array([7]))
    );

    const pending = resources.manager.resolveURL("textures\\skin.png");
    const fetched = await resources.fetched();
    const content = await fetch(resources.manager.resolveURL("textures\\skin.png"));

    assert.ok(pending.startsWith("data:image/png;base64,"));
    assert.ok(fetched);
    assert.deepEqual(new Uint8Array(await content.arrayBuffer()), new Uint8Array([7]));
    assert.deepEqual(resources.names, []);
    resources.dispose();
  });

  test("turns stale when an asset lands at a path it resolved, not elsewhere", () => {
    const catalog = new FakeModelCatalog();
    let stale = 0;
    const resources = modelResources(catalog, () => {
      stale++;
    });
    resources.manager.resolveURL("textures/skin.png");

    catalog.add("models/skin.png", new Uint8Array());
    const unrelated = stale;
    catalog.add("models/textures/skin.png", new Uint8Array());

    assert.equal(unrelated, 0);
    assert.equal(stale, 1);
    resources.dispose();
  });
});
