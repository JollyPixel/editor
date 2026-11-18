// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UnknownEntryError } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import {
  actorNamed,
  openScene
} from "../helpers/golem.ts";

describe("SceneAsset intents", () => {
  test("adds several root actors with their children", async() => {
    const { scene } = await openScene();

    const added = await scene.addActors({
      actors: [
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
      ]
    });
    await scene.settled();

    assert.deepEqual(added.map(({ name }) => name), ["Tower", "Roof", "Well"]);
    const [tower, roof, well] = added.map(({ id }) => scene.tree.actor(id));
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
    const { scene, hosted } = await openScene();

    await assert.rejects(
      scene.addActors({
        parentId: "nowhere",
        actors: [{ name: "Lost" }]
      }),
      {
        name: "UnknownEntryError",
        message: /no actor "nowhere"/
      }
    );
    assert.deepEqual(hosted.room.sent, []);
  });

  test("moves, transforms and removes actors named by name or id", async() => {
    const { scene } = await openScene();
    const [tower] = await scene.addActors({
      actors: [
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
      ]
    });

    await scene.moveActors({
      actors: ["Well"],
      parent: tower.id,
      before: "Roof"
    });
    await scene.transformActors({
      changes: [
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
      ]
    });
    await scene.settled();

    const well = scene.tree.actor(actorNamed(scene, "Well"));
    const roof = scene.tree.actor(actorNamed(scene, "Roof"));
    assert.deepEqual(
      [...scene.tree.actors()]
        .filter(({ parentId }) => parentId === tower.id)
        .map(({ name }) => name),
      ["Well", "Roof"]
    );
    assert.deepEqual(well?.transform.position, { x: 3, y: 0, z: 0 });
    assert.deepEqual(roof?.transform.scale, { x: 2, y: 2, z: 2 });

    await scene.removeActors({ actors: ["Well", "Tower"] });
    await scene.settled();

    assert.deepEqual(
      [...scene.tree.actors()].map(({ name }) => name),
      ["Main Camera", "Sun", "Sky"]
    );
  });

  test("lists the ids of actors sharing a name, and sends nothing", async() => {
    const { scene, hosted } = await openScene();
    const walls = await scene.addActors({
      actors: [{ name: "Wall" }, { name: "Wall" }]
    });
    await scene.settled();
    const sent = hosted.room.sent.length;

    await assert.rejects(
      scene.removeActors({ actors: ["Wall"] }),
      (error: unknown) => error instanceof UnknownEntryError &&
        error.candidates.join() === walls.map(({ id }) => `${id} at the root`).join()
    );
    assert.equal(hosted.room.sent.length, sent);
  });
});
