// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ComponentSlotError } from "@jolly-pixel/server";

// Import Internal Dependencies
import { UnknownEntryError } from "#src/assets/errors/UnknownEntryError.ts";
import { UnknownAssetError } from "#src/peer/errors/UnknownAssetError.ts";
import { SceneStudio } from "../helpers/SceneStudio.ts";

describe("SceneAsset intents", { timeout: 5_000 }, () => {
  test("adds several root actors with their children", async() => {
    const studio = new SceneStudio();
    await studio.open();

    const added = await studio.scene.addActors([
      {
        name: "Tower",
        transform: {
          position: {
            x: 4,
            y: 0,
            z: -2
          }
        },
        children: [
          {
            name: "Roof",
            components: [{ type: "Light" }]
          }
        ]
      },
      {
        name: "Well"
      }
    ]);
    await studio.answer();
    await studio.scene.settled();

    assert.deepEqual(added.map(({ name }) => name), ["Tower", "Roof", "Well"]);
    const [tower, roof, well] = added.map(({ id }) => studio.scene.tree.actor(id));
    assert.deepEqual(
      [tower?.parentId, roof?.parentId, well?.parentId],
      [null, tower?.id, null]
    );
    assert.deepEqual(tower?.transform, {
      position: {
        x: 4,
        y: 0,
        z: -2
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0
      },
      scale: {
        x: 1,
        y: 1,
        z: 1
      }
    });
    assert.deepEqual(roof?.components.map(({ type }) => type), ["Light"]);
  });

  test("sends no actor under a parent the scene does not have", async() => {
    const studio = new SceneStudio();
    await studio.open();

    await assert.rejects(
      studio.scene.addActors([{ name: "Lost" }], { parentId: "nowhere" }),
      {
        name: "UnknownEntryError",
        message: /no actor "nowhere"/
      }
    );
    assert.deepEqual(studio.room.sent, []);
  });

  test("moves, transforms and removes actors named by name or id", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const [tower] = await studio.scene.addActors([
      {
        name: "Tower",
        children: [{ name: "Roof" }]
      },
      {
        name: "Well",
        transform: {
          position: {
            x: 3,
            y: 0,
            z: 0
          }
        }
      }
    ]);

    await studio.scene.moveActors(["Well"], {
      parent: tower.id,
      before: "Roof"
    });
    await studio.scene.transformActors([
      {
        actor: "Roof",
        transform: {
          scale: {
            x: 2,
            y: 2,
            z: 2
          }
        }
      }
    ]);
    await studio.answer();
    await studio.scene.settled();

    const well = studio.scene.tree.actor(studio.actorNamed("Well"));
    const roof = studio.scene.tree.actor(studio.actorNamed("Roof"));
    assert.deepEqual(
      [...studio.scene.tree.actors()]
        .filter(({ parentId }) => parentId === tower.id)
        .map(({ name }) => name),
      ["Well", "Roof"]
    );
    assert.deepEqual(well?.transform.position, { x: 3, y: 0, z: 0 });
    assert.deepEqual(roof?.transform.scale, { x: 2, y: 2, z: 2 });

    await studio.scene.removeActors(["Well", "Tower"]);
    await studio.answer();
    await studio.scene.settled();

    assert.deepEqual(
      [...studio.scene.tree.actors()].map(({ name }) => name),
      ["Main Camera", "Sun", "Sky"]
    );
  });

  test("lists the ids of actors sharing a name, and sends nothing", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const walls = await studio.scene.addActors([{ name: "Wall" }, { name: "Wall" }]);
    await studio.answer();
    const sent = studio.room.sent.length;

    await assert.rejects(
      studio.scene.removeActors(["Wall"]),
      (error: unknown) => error instanceof UnknownEntryError &&
        error.candidates.join() === walls.map(({ id }) => `${id} at the root`).join()
    );
    assert.equal(studio.room.sent.length, sent);
  });

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
});
