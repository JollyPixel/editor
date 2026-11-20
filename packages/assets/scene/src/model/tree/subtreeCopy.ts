// Import Third-party Dependencies
import { randomId } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  SceneActorJSON,
  SceneActorView,
  SceneComponentJSON
} from "../../network/types.ts";
import { ownedCopy } from "../ownedCopy.ts";

// CONSTANTS
const kCopySuffix = /^(?<base>.*) \((?<count>\d+)\)$/;

export function copySubtree(
  source: readonly SceneActorView[],
  siblingNames: ReadonlySet<string>
): SceneActorJSON[] {
  const ids = new Map<string, string>();
  const componentIds = new Map<string, string>();
  for (const actor of source) {
    ids.set(actor.id, randomId());
    for (const component of actor.components) {
      componentIds.set(component.id, randomId());
    }
  }

  return source.map((actor, index) => {
    const copy = ownedCopy<SceneActorJSON>(actor);

    return {
      ...copy,
      id: ids.get(actor.id)!,
      name: index === 0 ? copyName(actor.name, siblingNames) : actor.name,
      parentId: actor.parentId === null ?
        null :
        ids.get(actor.parentId) ?? actor.parentId,
      components: copy.components.map(
        (component) => copyComponent(component, componentIds)
      ),
      ...copy.anchor === undefined ? {} : {
        anchor: {
          ...copy.anchor,
          component: componentIds.get(copy.anchor.component) ?? copy.anchor.component
        }
      }
    };
  });
}

function copyComponent(
  component: SceneComponentJSON,
  componentIds: ReadonlyMap<string, string>
): SceneComponentJSON {
  const { connections } = component;

  return {
    ...component,
    id: componentIds.get(component.id)!,
    ...connections === undefined ? {} : {
      connections: connections.map((connection) => {
        return {
          ...connection,
          target: componentIds.get(connection.target) ?? connection.target
        };
      })
    }
  };
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
