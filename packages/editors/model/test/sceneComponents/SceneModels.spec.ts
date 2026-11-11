// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ModelFileDocument } from "@jolly-pixel/asset.model/client";
import type { SceneAssetContext } from "@jolly-pixel/editor.host/scene";
import type { Model } from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SceneModels } from "#src/sceneComponents/SceneModels.ts";
import { cubeModelGlb } from "#src/seed/cubeModel.ts";
import { FakeModelCatalog } from "../helpers/file/FakeModelCatalog.ts";

// CONSTANTS
const kReference = {
  kind: "model",
  id: "model-1"
};

function sceneModels(
  bytes: Uint8Array | null = cubeModelGlb()
) {
  const document = new ModelFileDocument();
  if (bytes !== null) {
    document.load(bytes);
  }
  const release = mock.fn();
  const session = {
    assets: {
      open: () => {
        return {
          document,
          ready: Promise.resolve(),
          release
        };
      }
    },
    catalog: new FakeModelCatalog()
      .add("models/cube.glb", new Uint8Array(), kReference.id)
  } as unknown as SceneAssetContext;
  let loaded = Promise.withResolvers<void>();
  const models = new SceneModels(session, {
    loaded: () => loaded.resolve()
  });

  return {
    models,
    document,
    release,
    async nextLoad(): Promise<Model | null> {
      await loaded.promise;
      loaded = Promise.withResolvers<void>();

      return models.resolve(kReference);
    }
  };
}

function disposed(
  model: Model
): () => boolean {
  let done = false;
  model.object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.addEventListener("dispose", () => {
        done = true;
      });
    }
  });

  return () => done;
}

describe("SceneModels", () => {
  test("resolves the model once its file is parsed", async() => {
    const { models, nextLoad } = sceneModels();

    const pending = models.resolve(kReference);
    const model = await nextLoad();

    assert.equal(pending, null);
    assert.deepEqual(
      model?.animations.map((clip) => clip.name),
      ["spin", "bounce"]
    );
  });

  test("is ready once the model file is parsed", async() => {
    const { models } = sceneModels();

    await models.ready(kReference);

    assert.ok(models.resolve(kReference) !== null);
  });

  test("rejects ready when the model file cannot be parsed", async() => {
    const { models } = sceneModels(new Uint8Array([1, 2, 3, 4]));

    await assert.rejects(models.ready(kReference));
    assert.equal(models.resolve(kReference), null);
  });

  test("is ready with no model when the asset has no file yet", async() => {
    const { models } = sceneModels(null);

    await models.ready(kReference);

    assert.equal(models.resolve(kReference), null);
  });

  test("replaces the model and disposes the old one when the file changes", async() => {
    const { models, document, nextLoad } = sceneModels();
    models.resolve(kReference);
    const first = await nextLoad();
    assert.ok(first !== null);
    const firstDisposed = disposed(first);

    document.load(cubeModelGlb());
    const second = await nextLoad();

    assert.ok(second !== null);
    assert.notStrictEqual(second, first);
    assert.equal(firstDisposed(), true);
  });

  test("releases its leases and models when disposed", async() => {
    const { models, release, nextLoad } = sceneModels();
    models.resolve(kReference);
    const model = await nextLoad();
    assert.ok(model !== null);
    const modelDisposed = disposed(model);

    models.dispose();

    assert.equal(release.mock.callCount(), 1);
    assert.equal(modelDisposed(), true);
  });
});
