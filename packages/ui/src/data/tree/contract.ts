// Import Internal Dependencies
import { emitComposedEvent } from "../../events.ts";
import type { IconName } from "../../icon/registry.ts";
import type { PeerAvatar } from "../../peer/Avatar.ts";

export type TreeDropWhere =
  | "above"
  | "inside"
  | "below";

export interface TreeBadge {
  color: string;
  title?: string;
}

/**
 * Where a row draws its swatch: before the label, or after the detail.
 */
export type TreeSwatchPosition = "start" | "end";

export interface TreeSwatch {
  title: string;
  /**
   * Any CSS colour; empty when omitted.
   */
  color?: string;
  ring?: string;
}

export interface TreeNode<
  TData = unknown
> {
  id: string;
  label: string;
  children?: TreeNode<TData>[];
  /**
   * `false` keeps the children shown, with no expand toggle.
   */
  collapsible?: boolean;
  icon?: IconName;
  /**
   * Drawn in place of `icon`, for a row that stands for a person.
   */
  avatar?: PeerAvatar;
  visible?: boolean;
  locked?: boolean;
  renamable?: boolean;
  detail?: string;
  badges?: TreeBadge[];
  swatch?: TreeSwatch;
  /**
   * Flags the row as a problem; the text is its tooltip.
   */
  warning?: string;
  data?: TData;
}

export interface JollySelectDetail {
  selected: string[];
}

export interface JollyActivateDetail {
  id: string;
}

export interface JollyActivateSwatchDetail {
  id: string;
}

export interface JollyContextRequestDetail {
  /**
   * `null` for the tree itself.
   */
  id: string | null;
  x: number;
  y: number;
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

export interface JollyRenameDetail {
  id: string;
  name: string;
}

/**
 * Why `name` is refused for the row, or `null` to accept it.
 */
export type TreeRenameValidator = (
  detail: JollyRenameDetail
) => string | null;

export interface JollyReparentDetail {
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
}

export type TreeDropAccept = (
  detail: JollyReparentDetail
) => boolean;

export interface DataEventMap {
  "jolly-select": JollySelectDetail;
  "jolly-activate": JollyActivateDetail;
  "jolly-activate-swatch": JollyActivateSwatchDetail;
  "jolly-context-request": JollyContextRequestDetail;
  "jolly-toggle-expand": JollyToggleExpandDetail;
  "jolly-toggle-visible": JollyToggleVisibleDetail;
  "jolly-toggle-lock": JollyToggleLockDetail;
  "jolly-rename": JollyRenameDetail;
  "jolly-reparent": JollyReparentDetail;
}

export function emitDataEvent<KName extends keyof DataEventMap>(
  target: EventTarget,
  name: KName,
  detail: DataEventMap[KName]
): void {
  emitComposedEvent(target, name, detail);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-select": CustomEvent<JollySelectDetail>;
    "jolly-activate": CustomEvent<JollyActivateDetail>;
    "jolly-activate-swatch": CustomEvent<JollyActivateSwatchDetail>;
    "jolly-context-request": CustomEvent<JollyContextRequestDetail>;
    "jolly-toggle-expand": CustomEvent<JollyToggleExpandDetail>;
    "jolly-toggle-visible": CustomEvent<JollyToggleVisibleDetail>;
    "jolly-toggle-lock": CustomEvent<JollyToggleLockDetail>;
    "jolly-rename": CustomEvent<JollyRenameDetail>;
    "jolly-reparent": CustomEvent<JollyReparentDetail>;
  }
}
