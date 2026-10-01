// Import Third-party Dependencies
import type {
  Keyboard,
  KeyBindingHandler,
  KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  BRUSH_AXES,
  type BrushAxis,
  type BrushStore,
  type SelectionStore
} from "../../../state/index.ts";

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

  function onVoxelLayer(
    action: () => void
  ): KeyBindingHandler {
    return () => {
      if (selection.voxelLayer === null) {
        return false;
      }
      action();

      return true;
    };
  }

  const releases = [
    keyboard.bind(BRUSH_SHORTCUTS.mode, onVoxelLayer(() => {
      brush.mode = brush.mode === "build" ? "replace" : "build";
    })),
    keyboard.bind(BRUSH_SHORTCUTS.axis, onVoxelLayer(() => {
      brush.axis = nextAxis(brush.axis);
    })),
    keyboard.bind(BRUSH_SHORTCUTS.pattern, onVoxelLayer(() => {
      brush.pattern = brush.pattern === "square" ? "circle" : "square";
    })),
    keyboard.bind(BRUSH_SHORTCUTS.ghost, onVoxelLayer(() => {
      brush.ghost = !brush.ghost;
    })),
    keyboard.bind(BRUSH_SHORTCUTS.shrink, onVoxelLayer(() => {
      brush.resize(-1);
    }), { repeat: true }),
    keyboard.bind(BRUSH_SHORTCUTS.grow, onVoxelLayer(() => {
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
