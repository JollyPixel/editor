// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";
import { ModelFileDocument } from "@jolly-pixel/asset.model/client";
import type { SceneAssetContext } from "@jolly-pixel/editor.host/scene";
import type { Model } from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SceneModels } from "#src/sceneComponents/SceneModels.ts";
import { cubeModelGlb } from "#src/seed/cubeModel.ts";

// CONSTANTS
const kReference = {
  kind: "model",
  id: "model-1"
};

function sceneModels() {
  const document = new ModelFileDocument();
  document.load(encodeContent(cubeModelGlb()));
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
    catalog: {
      record: () => {
        return {
          path: "models/cube.glb"
        };
      }
    }
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

  test("replaces the model and disposes the old one when the file changes", async() => {
    const { models, document, nextLoad } = sceneModels();
    models.resolve(kReference);
    const first = await nextLoad();
    assert.ok(first !== null);
    const firstDisposed = disposed(first);

    document.load(encodeContent(cubeModelGlb()));
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
