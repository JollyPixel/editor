// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { sceneEditableKind } from "../network/server.ts";
import { SceneAsset } from "./SceneAsset.ts";
import {
  addActorsInputSchema,
  addComponentsInputSchema,
  moveActorsInputSchema,
  removeActorsInputSchema,
  transformActorsInputSchema,
  useEnvironmentInputSchema
} from "./SceneInputs.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);

export const SCENE_GOLEM_KIND = golemKind(sceneEditableKind(), SceneAsset, {
  guide: kGuide,
  intents: {
    addActors: golemIntent({
      description: "Add actors, with their children and components. New " +
        "actors get fresh ids: the result lists every one as { id, name }, " +
        "parents before their children.",
      input: addActorsInputSchema,
      run: (scene: SceneAsset, input) => scene.addActors(input)
    }),
    transformActors: golemIntent({
      description: "Change the position, rotation or scale of actors, " +
        "relative to their parent. Fields left out keep their value.",
      input: transformActorsInputSchema,
      run: (scene: SceneAsset, input) => scene.transformActors(input)
    }),
    moveActors: golemIntent({
      description: "Move actors under another parent, in the given order. " +
        "Each actor keeps its transform, which is relative to its parent: " +
        "transform it after when the new parent is placed elsewhere.",
      input: moveActorsInputSchema,
      run: (scene: SceneAsset, input) => scene.moveActors(input)
    }),
    removeActors: golemIntent({
      description: "Remove actors with their children.",
      input: removeActorsInputSchema,
      run: (scene: SceneAsset, input) => scene.removeActors(input)
    }),
    addComponents: golemIntent({
      description: "Add components to an actor. The result lists the new " +
        "components as { id, type }.",
      input: addComponentsInputSchema,
      run: (scene: SceneAsset, input) => scene.addComponents(input)
    }),
    useEnvironment: golemIntent({
      description: "Pick the environment asset the scene renders in. " +
        "Lights in the scene add to the environment's sun and ambient " +
        "light. Answers the environment reference, null for the default.",
      input: useEnvironmentInputSchema,
      run: (scene: SceneAsset, input) => scene.useEnvironment(input)
    })
  }
});
