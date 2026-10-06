// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import {
  TICKS_PER_SECOND,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  ClipTarget,
  LinkedAnimationSet
} from "./AnimationLibrary.ts";

export interface RowTarget {
  setId: string;
  /** `null` for the model's own clips. */
  target: ClipTarget;
  clipId: string | null;
}

export interface ClipRow extends RowTarget {
  clipId: string;
}

export function setNode(
  set: LinkedAnimationSet
): TreeNode<RowTarget> {
  return {
    id: setRowId(set.id),
    label: set.name,
    icon: "model-animate",
    detail: set.users > 1 ? `${set.users} models` : "",
    data: { setId: set.id, target: set.id, clipId: null },
    children: clipNodes(set)
  };
}

export function clipNodes(
  set: LinkedAnimationSet
): TreeNode<RowTarget>[] {
  const target = set.own ? null : set.id;

  return [...set.document.set.clips()].map((clip) => {
    return {
      id: clipRowId(set.id, clip.id),
      label: clip.name,
      renamable: true,
      detail: `${(clip.length / TICKS_PER_SECOND).toFixed(1)}s`,
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

  return clip === undefined ? setRowId(set.id) : clipRowId(set.id, clip.id);
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

export function setRowId(
  setId: string
): string {
  return `set:${setId}`;
}

function clipRowId(
  setId: string,
  clipId: string
): string {
  return `clip:${setId}:${clipId}`;
}
