// Import Internal Dependencies
import type { SceneTreeReader } from "../tree/SceneTree.ts";
import type { SceneCommand } from "../../network/types.ts";

export function sceneCommandActor(
  tree: Pick<SceneTreeReader, "componentOwner">,
  command: SceneCommand
): string | null {
  switch (command.action) {
    case "actor-added":
      return command.actors[0].id;
    case "actor-removed":
    case "actor-moved":
    case "actor-renamed":
    case "actor-visibility":
    case "actor-transformed":
    case "actor-overridden":
    case "component-overridden":
      return command.id;
    case "component-added":
    case "component-removed":
    case "component-moved":
      return command.actorId;
    case "component-changed":
    case "component-assets-changed":
      return tree.componentOwner(command.id) ?? null;
    case "environment-changed":
      return null;
  }
}
