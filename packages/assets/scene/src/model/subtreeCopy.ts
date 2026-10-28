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
  const componentIds = new Map<string, string>();

  return source.map((actor, index) => {
    const copy = structuredClone(actor);
    const id = randomId();
    ids.set(actor.id, id);
    const components = copy.components.map((component) => {
      const componentId = randomId();
      componentIds.set(component.id, componentId);

      return {
        ...component,
        id: componentId
      };
    });

    return {
      ...copy,
      id,
      name: index === 0 ? copyName(actor.name) : actor.name,
      parentId: actor.parentId === null ?
        null :
        ids.get(actor.parentId) ?? actor.parentId,
      components,
      ...copy.anchor === undefined ? {} : {
        anchor: {
          ...copy.anchor,
          component: componentIds.get(copy.anchor.component) ?? copy.anchor.component
        }
      }
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
