// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  KindMismatchError,
  UnknownAssetError
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { ComponentSlotError } from "#src/golem/index.ts";
import {
  actorNamed,
  openScene
} from "../helpers/golem.ts";

describe("SceneAsset asset references", () => {
  test("adds components whose asset slots name a catalog path", async() => {
    const { scene } = await openScene([
      {
        id: "tree-model",
        kind: "model",
        path: "models/tree.obj"
      }
    ]);

    const [model, empty] = await scene.addComponents({
      actor: "Sun",
      components: [
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
      ]
    });
    await scene.settled();

    assert.deepEqual(scene.tree.component(model.id)?.assets, {
      model: {
        id: "tree-model",
        kind: "model"
      }
    });
    assert.equal(scene.tree.componentOwner(empty.id), actorNamed(scene, "Sun"));
    await assert.rejects(
      scene.addComponents({
        actor: "Sun",
        components: [
          {
            type: "Model",
            assets: {
              model: "models/rock.obj"
            }
          }
        ]
      }),
      UnknownAssetError
    );
  });

  test("refuses components the studio does not declare, before sending", async() => {
    const { scene, hosted } = await openScene([
      {
        id: "spin-script",
        kind: "script",
        path: "scripts/spin.ts"
      }
    ]);
    const [model] = await scene.addComponents({
      actor: "Sun",
      components: [{ type: "Model" }]
    });
    await scene.settled();
    const sent = hosted.room.sent.length;

    await assert.rejects(
      scene.addComponents({
        actor: "Sun",
        components: [{ type: "Modle" }]
      }),
      /The studio has no "Modle" component\. Its components: Light, Model\./
    );
    await assert.rejects(
      scene.addActors({
        actors: [
          {
            name: "Lamp",
            components: [{ type: "Light", assets: { cookie: null } }]
          }
        ]
      }),
      /The "Light" component's "cookie" slot does not exist; its slots: none\./
    );
    await assert.rejects(
      scene.addComponents({
        actor: "Sun",
        components: [
          {
            type: "Model",
            assets: {
              model: "scripts/spin.ts"
            }
          }
        ]
      }),
      /The "Model" component's "model" slot takes a "model" asset, not a "script"\./
    );
    await assert.rejects(
      scene.apply([
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
    assert.equal(hosted.room.sent.length, sent);
  });

  test("picks an environment by catalog path, and sends no other kind", async() => {
    const { scene, hosted } = await openScene([
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

    const environment = await scene.useEnvironment({
      environment: "environments/dusk.environment.json"
    });
    await scene.settled();
    const sent = hosted.room.sent.length;

    assert.deepEqual(environment, {
      id: "dusk-environment",
      kind: "environment"
    });
    assert.deepEqual(hosted.state.snapshot().environment, environment);
    await assert.rejects(
      scene.useEnvironment({ environment: "scripts/spin.ts" }),
      KindMismatchError
    );
    assert.equal(hosted.room.sent.length, sent);

    await scene.useEnvironment({ environment: null });
    await scene.settled();

    assert.equal(hosted.state.snapshot().environment, null);
  });
});
