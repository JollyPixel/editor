// Import Third-party Dependencies
import type {
  Keyboard,
  KeyBindingHandler,
  KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { SelectionStore } from "../../../state/index.ts";
import {
  BRUSH_AXES,
  type BrushAxis,
  type BrushStore
} from "../BrushStore.ts";

export const BRUSH_SHORTCUTS = {
  mode: ["r"],
  axis: ["x"],
  pattern: ["c"],
  ghost: ["g"],
  shrink: ["BracketLeft"],
  grow: ["BracketRight"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface BrushShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  brush: BrushStore;
  selection: SelectionStore;
}

export function bindBrushShortcuts(
  options: BrushShortcutsOptions
): () => void {
  const { keyboard, brush, selection } = options;

  function whilePaintable(
    action: () => void
  ): KeyBindingHandler {
    return () => {
      if (selection.voxelLayer === null || brush.suspended) {
        return false;
      }
      action();

      return true;
    };
  }

  const releases = [
    keyboard.bind(BRUSH_SHORTCUTS.mode, whilePaintable(() => {
      brush.mode = brush.mode === "build" ? "replace" : "build";
    })),
    keyboard.bind(BRUSH_SHORTCUTS.axis, whilePaintable(() => {
      brush.axis = nextAxis(brush.axis);
    })),
    keyboard.bind(BRUSH_SHORTCUTS.pattern, whilePaintable(() => {
      brush.pattern = brush.pattern === "square" ? "circle" : "square";
    })),
    keyboard.bind(BRUSH_SHORTCUTS.ghost, whilePaintable(() => {
      brush.ghost = !brush.ghost;
    })),
    keyboard.bind(BRUSH_SHORTCUTS.shrink, whilePaintable(() => {
      brush.resize(-1);
    }), { repeat: true }),
    keyboard.bind(BRUSH_SHORTCUTS.grow, whilePaintable(() => {
      brush.resize(1);
    }), { repeat: true })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}

function nextAxis(
  axis: BrushAxis
): BrushAxis {
  const index = BRUSH_AXES.indexOf(axis);

  return BRUSH_AXES[(index + 1) % BRUSH_AXES.length];
}
