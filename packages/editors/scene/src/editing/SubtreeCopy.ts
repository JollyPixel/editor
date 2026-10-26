// Import Third-party Dependencies
import {
  randomId,
  type SceneActorJSON
} from "@jolly-pixel/asset.scene/client";

// CONSTANTS
const kCopySuffix = /^(?<base>.*) \((?<count>\d+)\)$/;

export class SubtreeCopy {
  static #copyName(
    name: string
  ): string {
    const match = kCopySuffix.exec(name);
    if (match?.groups === undefined) {
      return `${name} (1)`;
    }

    return `${match.groups.base} (${Number(match.groups.count) + 1})`;
  }

  readonly rootId: string;
  readonly actors: SceneActorJSON[];

  constructor(
    source: readonly SceneActorJSON[]
  ) {
    const ids = new Map<string, string>();
    this.actors = source.map((actor, index) => {
      const copy = structuredClone(actor);
      const id = randomId();
      ids.set(actor.id, id);

      return {
        ...copy,
        id,
        name: index === 0 ? SubtreeCopy.#copyName(actor.name) : actor.name,
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

    const [root] = this.actors;
    if (root === undefined) {
      throw new Error("SubtreeCopy: the source subtree is empty.");
    }
    this.rootId = root.id;
  }
}
