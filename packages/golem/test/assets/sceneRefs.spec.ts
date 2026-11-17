// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ComponentSlotError } from "@jolly-pixel/asset.scene/golem";
import {
  KindMismatchError,
  UnknownAssetError
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { SceneStudio } from "../helpers/SceneStudio.ts";

describe("SceneAsset asset references", { timeout: 5_000 }, () => {
  test("adds components whose asset slots name a catalog path", async() => {
    const studio = new SceneStudio([
      {
        id: "tree-model",
        kind: "model",
        path: "models/tree.obj"
      }
    ]);
    await studio.open();

    const [model, empty] = await studio.scene.addComponents("Sun", [
      {
        type: "Model",
        assets: {
          model: "models/tree.obj"
        }
      },
      {
        type: "Model",
        assets: {
          model: null
        }
      }
    ]);
    await studio.answer();
    await studio.scene.settled();

    assert.deepEqual(studio.scene.tree.component(model.id)?.assets, {
      model: {
        id: "tree-model",
        kind: "model"
      }
    });
    assert.equal(studio.scene.tree.componentOwner(empty.id), studio.actorNamed("Sun"));
    await assert.rejects(
      studio.scene.addComponents("Sun", [
        {
          type: "Model",
          assets: {
            model: "models/rock.obj"
          }
        }
      ]),
      UnknownAssetError
    );
  });

  test("refuses components the studio does not declare, before sending", async() => {
    const studio = new SceneStudio([
      {
        id: "spin-script",
        kind: "script",
        path: "scripts/spin.ts"
      }
    ]);
    await studio.open();
    const [model] = await studio.scene.addComponents("Sun", [{ type: "Model" }]);
    await studio.answer();
    await studio.scene.settled();
    const sent = studio.room.sent.length;

    await assert.rejects(
      studio.scene.addComponents("Sun", [{ type: "Modle" }]),
      /The studio has no "Modle" component\. Its components: Light, Model\./
    );
    await assert.rejects(
      studio.scene.addActors([
        {
          name: "Lamp",
          components: [{ type: "Light", assets: { cookie: null } }]
        }
      ]),
      /The "Light" component's "cookie" slot does not exist; its slots: none\./
    );
    await assert.rejects(
      studio.scene.addComponents("Sun", [
        {
          type: "Model",
          assets: {
            model: "scripts/spin.ts"
          }
        }
      ]),
      /The "Model" component's "model" slot takes a "model" asset, not a "script"\./
    );
    await assert.rejects(
      studio.scene.apply([
        {
          action: "component-assets-changed",
          id: model.id,
          assets: {
            model: {
              id: "spin-script",
              kind: "script"
            }
          }
        }
      ]),
      ComponentSlotError
    );
    assert.equal(studio.room.sent.length, sent);
  });

  test("picks an environment by catalog path, and sends no other kind", async() => {
    const studio = new SceneStudio([
      {
        id: "dusk-environment",
        kind: "environment",
        path: "environments/dusk.environment.json"
      },
      {
        id: "spin-script",
        kind: "script",
        path: "scripts/spin.ts"
      }
    ]);
    await studio.open();

    await studio.scene.useEnvironment("environments/dusk.environment.json");
    await studio.answer();
    await studio.scene.settled();
    const sent = studio.room.sent.length;

    assert.deepEqual(studio.server.state.snapshot().environment, {
      id: "dusk-environment",
      kind: "environment"
    });
    await assert.rejects(
      studio.scene.useEnvironment("scripts/spin.ts"),
      KindMismatchError
    );
    assert.equal(studio.room.sent.length, sent);

    await studio.scene.useEnvironment(null);
    await studio.answer();
    await studio.scene.settled();

    assert.equal(studio.server.state.snapshot().environment, null);
  });
});
