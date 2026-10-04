// Import Internal Dependencies
import { nextEnabledIndex } from "../../controls/roving.ts";

export type ContextMenuKeyAction =
  | { kind: "focus"; index: number; }
  | { kind: "activate"; index: number; }
  | { kind: "open"; index: number; }
  | { kind: "back"; }
  | { kind: "close"; }
  | { kind: "none"; };

export interface ContextMenuKeyItem {
  enabled: boolean;
  submenu: boolean;
}

export function contextMenuKeyAction(
  key: string,
  items: readonly ContextMenuKeyItem[],
  active: number,
  nested: boolean
): ContextMenuKeyAction {
  const enabled = items.map((item) => item.enabled);
  const focused: ContextMenuKeyItem | undefined = items[active];
  const opens = focused?.enabled === true && focused.submenu;

  switch (key) {
    case "ArrowDown":
      return focus(
        nextEnabledIndex(enabled, active, 1)
      );
    case "ArrowUp":
      return focus(
        nextEnabledIndex(enabled, Math.max(active, 0), -1)
      );
    case "Home":
      return focus(
        nextEnabledIndex(enabled, enabled.length - 1, 1)
      );
    case "End":
      return focus(
        nextEnabledIndex(enabled, 0, -1)
      );
    case "ArrowRight":
      return opens ?
        { kind: "open", index: active } :
        { kind: "none" };
    case "ArrowLeft":
      return nested ?
        { kind: "back" } :
        { kind: "none" };
    case "Enter":
    case " ":
      if (opens) {
        return { kind: "open", index: active };
      }

      return focused?.enabled === true ?
        { kind: "activate", index: active } :
        { kind: "none" };
    case "Tab":
      return { kind: "close" };
    default:
      return { kind: "none" };
  }
}

function focus(
  index: number
): ContextMenuKeyAction {
  return index === -1 ?
    { kind: "none" } :
    { kind: "focus", index };
}
