// Import Third-party Dependencies
import type {
  KeyBindingHandlers,
  KeyBindingTarget,
  KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { ToolStore } from "../state/index.ts";
import type { MapGroupAction } from "../keybindings/mapActions.ts";

export const TOOL_EXIT_SHORTCUT = [
  "Escape"
] as const satisfies readonly KeyChordString[];

export interface ToolShortcutsOptions {
  tool: ToolStore;
}

export function toolShortcuts(
  options: ToolShortcutsOptions
): KeyBindingHandlers<MapGroupAction<"tool">> {
  const { tool } = options;

  return {
    "tool.brush": () => {
      tool.current = "brush";
    },
    "tool.select": () => {
      if (tool.selecting) {
        tool.cycleSelectMode();
      }
      else {
        tool.current = "select";
      }
    }
  };
}

export function bindToolExit(
  keyboard: KeyBindingTarget,
  tool: ToolStore
): () => void {
  return keyboard.bind(TOOL_EXIT_SHORTCUT, () => {
    if (!tool.selecting) {
      return false;
    }
    tool.current = "brush";

    return true;
  });
}
