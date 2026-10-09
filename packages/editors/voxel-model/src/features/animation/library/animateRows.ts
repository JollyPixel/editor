// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import {
  peerBadges,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";
import {
  TICKS_PER_SECOND,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  clipTargetOf,
  type ClipTarget,
  type LinkedAnimationSet
} from "./AnimationLibrary.ts";
import {
  animationKey,
  type ClipKey
} from "../../../state/index.ts";

export type ClipFocuses = PeerMarkMap<ClipKey>;

export interface RowTarget {
  setId: string;
  /**
   * `null` for the model's own clips.
   */
  target: ClipTarget;
  clipId: string | null;
}

export interface ClipRow extends RowTarget {
  clipId: string;
}

export function setNode(
  set: LinkedAnimationSet,
  focuses: ClipFocuses
): TreeNode<RowTarget> {
  return {
    id: animationKey(set.id),
    label: set.name,
    icon: "model-animate",
    detail: set.users > 1 ? `${set.users} models` : "",
    data: { setId: set.id, target: set.id, clipId: null },
    children: clipNodes(set, focuses)
  };
}

export function clipNodes(
  set: LinkedAnimationSet,
  focuses: ClipFocuses
): TreeNode<RowTarget>[] {
  const target = clipTargetOf(set);

  return [...set.document.set.clips()].map((clip) => {
    const id = animationKey(set.id, clip.id);

    return {
      id,
      label: clip.name,
      renamable: true,
      detail: `${(clip.length / TICKS_PER_SECOND).toFixed(1)}s`,
      badges: peerBadges(id, focuses),
      data: { setId: set.id, target, clipId: clip.id }
    };
  });
}

export function asClipRow(
  row: RowTarget | undefined
): ClipRow | null {
  return row === undefined || row.clipId === null ? null : { ...row, clipId: row.clipId };
}

export function selectedRow(
  set: LinkedAnimationSet | null,
  clip: AnimationClipJSON | undefined
): string | null {
  if (set === null) {
    return null;
  }

  return animationKey(set.id, clip?.id);
}

export function findRow(
  nodes: readonly TreeNode<RowTarget>[],
  rowId: string | undefined
): RowTarget | undefined {
  for (const node of nodes) {
    if (node.id === rowId) {
      return node.data;
    }
    const found = findRow(node.children ?? [], rowId);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
