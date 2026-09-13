// Import Internal Dependencies
import type { IconName } from "../../icon/registry.ts";

export type TreeDropWhere =
  | "above"
  | "inside"
  | "below";

export interface TreeBadge {
  color: string;
  title?: string;
}

export interface TreeNode<
  TData = unknown
> {
  id: string;
  label: string;
  children?: TreeNode<TData>[];
  icon?: IconName;
  visible?: boolean;
  locked?: boolean;
  renamable?: boolean;
  badges?: TreeBadge[];
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

export interface JollyRenameDetail {
  id: string;
  name: string;
}

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
  const event = new CustomEvent<DataEventMap[KName]>(name, {
    detail,
    bubbles: true,
    composed: true
  });

  target.dispatchEvent(event);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-select": CustomEvent<JollySelectDetail>;
    "jolly-activate": CustomEvent<JollyActivateDetail>;
    "jolly-toggle-expand": CustomEvent<JollyToggleExpandDetail>;
    "jolly-toggle-visible": CustomEvent<JollyToggleVisibleDetail>;
    "jolly-toggle-lock": CustomEvent<JollyToggleLockDetail>;
    "jolly-rename": CustomEvent<JollyRenameDetail>;
    "jolly-reparent": CustomEvent<JollyReparentDetail>;
  }
}
