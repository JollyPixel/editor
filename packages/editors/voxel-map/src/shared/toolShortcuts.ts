// Import Third-party Dependencies
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type {
  EditorTool,
  ToolStore
} from "../state/index.ts";

export const TOOL_SHORTCUTS = {
  brush: ["b"],
  select: ["m"]
} as const satisfies Record<EditorTool, readonly KeyChordString[]>;

export const TOOL_EXIT_SHORTCUT = [
  "Escape"
] as const satisfies readonly KeyChordString[];

export interface ToolShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  tool: ToolStore;
}

export function bindToolShortcuts(
  options: ToolShortcutsOptions
): () => void {
  const { keyboard, tool } = options;
  const releases = [
    keyboard.bind(TOOL_SHORTCUTS.brush, () => {
      tool.current = "brush";
    }),
    keyboard.bind(TOOL_SHORTCUTS.select, () => {
      tool.current = "select";
    }),
    keyboard.bind(TOOL_EXIT_SHORTCUT, () => {
      if (!tool.selecting) {
        return false;
      }
      tool.current = "brush";

      return true;
    })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
