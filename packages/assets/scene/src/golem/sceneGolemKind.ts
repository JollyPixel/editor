// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import { sceneEditableKind } from "../network/server.ts";
import {
  actorSpecSchema,
  componentSpecSchema,
  transformPatchSchema
} from "./ActorSpec.ts";
import { SceneAsset } from "./SceneAsset.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);
const kActorRef = z.string().check(z.describe("An actor name or id. A name " +
  "shared by several actors fails with their ids."));

export const SCENE_GOLEM_KIND = golemKind(sceneEditableKind(), SceneAsset, {
  guide: kGuide,
  intents: {
    addActors: golemIntent({
      description: "Add actors, with their children and components. New " +
        "actors get fresh ids: the result lists every one as { id, name }, " +
        "parents before their children.",
      input: z.object({
        parentId: z.optional(z.nullable(kActorRef).check(
          z.describe("The actor name or id to add under. Default: the scene root.")
        )),
        actors: z.array(actorSpecSchema)
      }),
      run: async(scene: SceneAsset, { parentId, actors }) => {
        return {
          actors: await scene.addActors(actors, { parentId })
        };
      }
    }),
    transformActors: golemIntent({
      description: "Change the position, rotation or scale of actors, " +
        "relative to their parent. Fields left out keep their value.",
      input: z.object({
        changes: z.array(z.object({
          actor: kActorRef,
          transform: transformPatchSchema
        }))
      }),
      run: async(scene: SceneAsset, { changes }) => {
        await scene.transformActors(changes);

        return {
          transformed: changes.length
        };
      }
    }),
    moveActors: golemIntent({
      description: "Move actors under another parent, in the given order. " +
        "Each actor keeps its transform, which is relative to its parent: " +
        "transform it after when the new parent is placed elsewhere.",
      input: z.object({
        actors: z.array(kActorRef),
        parent: z.nullable(kActorRef).check(
          z.describe("The new parent's name or id, null for the scene root.")
        ),
        before: z.optional(kActorRef.check(
          z.describe("The child they go before. Default: after the last child.")
        ))
      }),
      run: async(scene: SceneAsset, { actors, parent, before }) => {
        await scene.moveActors(actors, { parent, before });

        return {
          moved: actors.length
        };
      }
    }),
    removeActors: golemIntent({
      description: "Remove actors with their children.",
      input: z.object({
        actors: z.array(kActorRef)
      }),
      run: async(scene: SceneAsset, { actors }) => {
        await scene.removeActors(actors);

        return {
          removed: actors.length
        };
      }
    }),
    addComponents: golemIntent({
      description: "Add components to an actor. The result lists the new " +
        "components as { id, type }.",
      input: z.object({
        actor: kActorRef,
        components: z.array(componentSpecSchema)
      }),
      run: async(scene: SceneAsset, { actor, components }) => {
        return {
          components: await scene.addComponents(actor, components)
        };
      }
    }),
    useEnvironment: golemIntent({
      description: "Pick the environment asset the scene renders in. " +
        "Lights in the scene add to the environment's sun and ambient light.",
      input: z.object({
        environment: z.nullable(z.string()).check(z.describe(
          "An environment asset id or catalog path; null for the default environment."
        ))
      }),
      run: async(scene: SceneAsset, { environment }) => {
        await scene.useEnvironment(environment);

        return {
          environment: scene.tree.environment
        };
      }
    })
  }
});
