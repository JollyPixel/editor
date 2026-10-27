// Import Third-party Dependencies
import { randomId } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type { SceneActorJSON } from "../network/types.ts";

// CONSTANTS
const kCopySuffix = /^(?<base>.*) \((?<count>\d+)\)$/;

export function copySubtree(
  source: readonly Readonly<SceneActorJSON>[]
): SceneActorJSON[] {
  const ids = new Map<string, string>();

  return source.map((actor, index) => {
    const copy = structuredClone(actor);
    const id = randomId();
    ids.set(actor.id, id);

    return {
      ...copy,
      id,
      name: index === 0 ? copyName(actor.name) : actor.name,
      parentId: actor.parentId === null ?
        null :
        ids.get(actor.parentId) ?? actor.parentId,
      components: copy.components.map((component) => {
        return {
          ...component,
          id: randomId()
        };
      })
    };
  });
}

function copyName(
  name: string
): string {
  const match = kCopySuffix.exec(name);
  if (match?.groups === undefined) {
    return `${name} (1)`;
  }

  return `${match.groups.base} (${Number(match.groups.count) + 1})`;
}
