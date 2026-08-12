export interface JollyResizeDetail {
  width: number;
  height: number;
  collapsed: boolean;
}

export interface JollyMoveDetail {
  x: number;
  y: number;
}

export interface JollyReorderDetail {
  keys: string[];
}

export interface JollyToggleDetail {
  open: boolean;
}

export interface JollyTabChangeDetail {
  value: string;
}

export interface PaneMoveDetail {
  pane: PaneElement;
  command: PaneMoveCommand;
}

export interface ContainerEventMap {
  "jolly-cancel": undefined;
  "jolly-close": { returnValue: string; };
  "jolly-folder-drag": { folder: Folder; event: PointerEvent; };
  "jolly-folder-reorder": {
    folder: Folder;
    command: "cancel" | "down" | "finish" | "start" | "up";
  };
  "jolly-layout-change": { snapshot: LayoutSnapshot; };
  "jolly-layout-dirty": undefined;
  "jolly-move": JollyMoveDetail;
  "jolly-move-end": JollyMoveDetail;
  "jolly-pane-drag": PaneDragDetail;
  "jolly-pane-move": PaneMoveDetail;
  "jolly-reorder": JollyReorderDetail;
  "jolly-resize": JollyResizeDetail;
  "jolly-resize-end": JollyResizeDetail;
  "jolly-tab-change": JollyTabChangeDetail;
  "jolly-toggle": JollyToggleDetail;
}

export function emitContainerEvent<KName extends keyof ContainerEventMap>(
  target: EventTarget,
  name: KName,
  detail: ContainerEventMap[KName]
): void {
  const event = new CustomEvent<ContainerEventMap[KName]>(name, {
    detail,
    bubbles: true,
    composed: true
  });
  target.dispatchEvent(event);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-cancel": CustomEvent<undefined>;
    "jolly-close": CustomEvent<{ returnValue: string; }>;
    "jolly-folder-drag": CustomEvent<ContainerEventMap["jolly-folder-drag"]>;
    "jolly-folder-reorder": CustomEvent<ContainerEventMap["jolly-folder-reorder"]>;
    "jolly-layout-change": CustomEvent<ContainerEventMap["jolly-layout-change"]>;
    "jolly-layout-dirty": CustomEvent<undefined>;
    "jolly-move": CustomEvent<JollyMoveDetail>;
    "jolly-move-end": CustomEvent<JollyMoveDetail>;
    "jolly-pane-drag": CustomEvent<PaneDragDetail>;
    "jolly-pane-move": CustomEvent<PaneMoveDetail>;
    "jolly-reorder": CustomEvent<JollyReorderDetail>;
    "jolly-resize": CustomEvent<JollyResizeDetail>;
    "jolly-resize-end": CustomEvent<JollyResizeDetail>;
    "jolly-tab-change": CustomEvent<JollyTabChangeDetail>;
    "jolly-toggle": CustomEvent<JollyToggleDetail>;
  }
}
// Import Internal Dependencies
import type { Folder } from "./Folder.ts";
import type { LayoutSnapshot } from "./layout.ts";
import type {
  PaneDragDetail,
  PaneElement,
  PaneMoveCommand
} from "./Pane.ts";
