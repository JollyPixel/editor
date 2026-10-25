// Import Third-party Dependencies
import type { SceneTreeReader } from "@jolly-pixel/asset.scene/client";
import type { TreeNode } from "@jolly-pixel/ui";
import {
  peerBadges,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  componentIcon,
  EMPTY_ACTOR_ICON
} from "../../components/sceneComponents.ts";

export function actorTreeNodes(
  tree: Pick<SceneTreeReader, "actorIds" | "peekActor">,
  marks: PeerMarkMap<string>
): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const id of tree.actorIds()) {
    const actor = tree.peekActor(id);
    if (actor === undefined) {
      continue;
    }

    const badges = peerBadges(id, marks);
    const node: TreeNode = {
      id,
      label: actor.name,
      icon: actorIcon(actor.components),
      visible: actor.visible,
      renamable: true,
      ...badges.length > 0 ? { badges } : {}
    };
    nodes.set(id, node);

    const parent = actor.parentId === null ? undefined : nodes.get(actor.parentId);
    if (parent === undefined) {
      roots.push(node);
    }
    else {
      (parent.children ??= []).push(node);
    }
  }

  return roots;
}

export function actorIcon(
  components: readonly { type: string; }[]
): string {
  for (const { type } of components) {
    const icon = componentIcon(type);
    if (icon !== EMPTY_ACTOR_ICON) {
      return icon;
    }
  }

  return EMPTY_ACTOR_ICON;
}
