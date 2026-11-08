// Import Internal Dependencies
import type {
  Actor,
  ActorTree
} from "../../../../actor/index.ts";
import type { ComponentDefinitions } from "../definitions/ComponentDefinitions.ts";
import type {
  SceneActorFile,
  SceneComponentFile
} from "../SceneFile.ts";
import { localSceneTransform } from "../sceneTransform.ts";
import { AnchorSocket } from "./SceneAnchors.ts";

export function captureSceneActors(
  tree: ActorTree<any>,
  components: ComponentDefinitions
): SceneActorFile[] {
  const files: SceneActorFile[] = [];

  for (const { actor, parent } of tree.walk()) {
    if (actor.pendingForDestruction) {
      continue;
    }

    const { socket } = actor.transform;
    files.push({
      id: actor.persistentId,
      name: actor.name,
      parentId: parent?.persistentId ?? null,
      visible: actor.transform.visible,
      transform: localSceneTransform(actor.transform),
      components: captureComponents(actor, components),
      ...socket instanceof AnchorSocket ? { anchor: { ...socket.anchor } } : {}
    });
  }

  return files;
}

function captureComponents(
  actor: Actor<any>,
  components: ComponentDefinitions
): SceneComponentFile[] {
  const files: SceneComponentFile[] = [];

  for (const component of actor.components) {
    const file = components.capture(component);
    if (file !== null) {
      files.push(file);
    }
  }

  return files;
}
