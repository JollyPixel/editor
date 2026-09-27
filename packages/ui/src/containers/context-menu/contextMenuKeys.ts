// Import Internal Dependencies
import { nextEnabledIndex } from "../../controls/roving.ts";

export type ContextMenuKeyAction =
  | { kind: "focus"; index: number; }
  | { kind: "activate"; index: number; }
  | { kind: "close"; }
  | { kind: "none"; };

export function contextMenuKeyAction(
  key: string,
  enabled: readonly boolean[],
  active: number
): ContextMenuKeyAction {
  switch (key) {
    case "ArrowDown":
      return focus(nextEnabledIndex(enabled, active, 1));
    case "ArrowUp":
      return focus(nextEnabledIndex(enabled, Math.max(active, 0), -1));
    case "Home":
      return focus(nextEnabledIndex(enabled, enabled.length - 1, 1));
    case "End":
      return focus(nextEnabledIndex(enabled, 0, -1));
    case "Enter":
    case " ":
      return enabled[active] === true ?
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
