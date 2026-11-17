// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UnknownEntryError } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
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
});
