// Import Internal Dependencies
import type { IconName } from "../icon/registry.ts";

export type TreeDropWhere =
  | "above"
  | "inside"
  | "below";

/**
 * A tree row.
 *
 * Structural, the same way `Vec3Like` is: a consumer's own domain object
 * satisfies this as long as the shape matches, no wrapper required.
 * `children` being present (even empty) is what marks a node as a branch
 * that accepts an "inside" drop; a leaf omits it entirely.
 */
export interface TreeNode<TData = unknown> {
  id: string;
  label: string;
  children?: TreeNode<TData>[];
  icon?: IconName;
  /** Rendered as an eye toggle when set. Omit for nodes with no visibility concept. */
  visible?: boolean;
  /** Rendered as a lock toggle when set. Omit for nodes with no lock concept. */
  locked?: boolean;
  /**
   * Whether the label accepts an inline edit, on a `renamable` tree. Omit or
   * set false for rows whose label is not the consumer's to change.
   */
  renamable?: boolean;
  data?: TData;
}

export interface JollySelectDetail {
  selected: string[];
}

export interface JollyActivateDetail {
  id: string;
}

export interface JollyToggleExpandDetail {
  id: string;
  expanded: boolean;
}

export interface JollyToggleVisibleDetail {
  id: string;
  visible: boolean;
}

export interface JollyToggleLockDetail {
  id: string;
  locked: boolean;
}

/**
 * A committed inline edit of a row label. Raw intent, like every other tree
 * event: the name is trimmed and non-empty, but the tree does not apply it.
 * The row keeps its old label until the consumer writes the new one back.
 */
export interface JollyRenameDetail {
  id: string;
  name: string;
}

/**
 * Raw drop intent. `jolly-tree` resolves and rejects the structural case (a
 * node dropped into itself or its own descendant) before this ever fires; a
 * domain veto — dropping a mesh into a group it should not join — is the
 * consumer's job, which is why this carries the drop location rather than an
 * already-computed node array. `resolveReparent` computes the common case.
 */
export interface JollyReparentDetail {
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
}
