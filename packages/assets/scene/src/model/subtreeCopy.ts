// Import Third-party Dependencies
import { randomId } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  SceneActorJSON,
  SceneActorView
} from "../network/types.ts";
import { ownedCopy } from "./ownedCopy.ts";

// CONSTANTS
const kCopySuffix = /^(?<base>.*) \((?<count>\d+)\)$/;

export function copySubtree(
  source: readonly SceneActorView[],
  siblingNames: ReadonlySet<string>
): SceneActorJSON[] {
  const ids = new Map<string, string>();
  const componentIds = new Map<string, string>();

  return source.map((actor, index) => {
    const copy = ownedCopy<SceneActorJSON>(actor);
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
      name: index === 0 ? copyName(actor.name, siblingNames) : actor.name,
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
  name: string,
  siblingNames: ReadonlySet<string>
): string {
  const groups = kCopySuffix.exec(name)?.groups;
  const base = groups === undefined ? name : groups.base;
  let count = groups === undefined ? 1 : Number(groups.count) + 1;
  while (siblingNames.has(`${base} (${count})`)) {
    count++;
  }

  return `${base} (${count})`;
}
