// Import Third-party Dependencies
import {
  randomId,
  type SceneActorJSON
} from "@jolly-pixel/asset.scene/client";

// CONSTANTS
const kCopySuffix = /^(?<base>.*) \((?<count>\d+)\)$/;

export function duplicateSubtree(
  actors: readonly SceneActorJSON[]
): SceneActorJSON[] {
  const ids = new Map<string, string>(
    actors.map((actor) => [actor.id, randomId()])
  );

  return actors.map((actor, index) => {
    return {
      ...structuredClone(actor),
      id: ids.get(actor.id)!,
      name: index === 0 ? duplicateName(actor.name) : actor.name,
      parentId: actor.parentId === null ?
        null :
        ids.get(actor.parentId) ?? actor.parentId,
      components: actor.components.map((component) => {
        return {
          ...structuredClone(component),
          id: randomId()
        };
      })
    };
  });
}

export function duplicateName(
  name: string
): string {
  const match = kCopySuffix.exec(name);
  if (match?.groups === undefined) {
    return `${name} (1)`;
  }

  return `${match.groups.base} (${Number(match.groups.count) + 1})`;
}
