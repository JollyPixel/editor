// Import Third-party Dependencies
import type {
  SceneActorJSON,
  SceneTreeReader
} from "@jolly-pixel/asset.scene/client";
import {
  resolveReparentMoves,
  type JollyReparentDetail,
  type ReparentMove,
  type TreeNode
} from "@jolly-pixel/ui";
import {
  peerBadges,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { SceneComponents } from "../../components/SceneComponents.ts";

// CONSTANTS
export const PREFAB_ICON = "actor-prefab";

export class ActorTreeRows {
  static readonly EMPTY = new ActorTreeRows([]);

  static read(
    tree: Pick<SceneTreeReader, "actorIds" | "peekActor">,
    marks: PeerMarkMap<string>,
    components: Pick<SceneComponents, "actorIcon">
  ): ActorTreeRows {
    const nodes = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];
    for (const id of tree.actorIds()) {
      const actor = tree.peekActor(id);
      if (actor === undefined) {
        continue;
      }

      const node = ActorTreeRows.#node(actor, marks, components);
      nodes.set(id, node);

      const parent = actor.parentId === null ? undefined : nodes.get(actor.parentId);
      if (parent === undefined) {
        roots.push(node);
      }
      else {
        (parent.children ??= []).push(node);
      }
    }

    return new ActorTreeRows(roots);
  }

  static #node(
    actor: Readonly<SceneActorJSON>,
    marks: PeerMarkMap<string>,
    components: Pick<SceneComponents, "actorIcon">
  ): TreeNode {
    const badges = peerBadges(actor.id, marks);

    return {
      id: actor.id,
      label: actor.name,
      icon: actor.prefab === undefined ?
        components.actorIcon(actor.components.map(({ type }) => type)) :
        PREFAB_ICON,
      visible: actor.visible,
      renamable: true,
      ...badges.length > 0 ? { badges } : {}
    };
  }

  readonly roots: TreeNode[];

  constructor(
    roots: TreeNode[]
  ) {
    this.roots = roots;
  }

  moves(
    detail: JollyReparentDetail
  ): ReparentMove[] {
    return resolveReparentMoves({
      nodes: this.roots,
      ...detail
    });
  }
}
