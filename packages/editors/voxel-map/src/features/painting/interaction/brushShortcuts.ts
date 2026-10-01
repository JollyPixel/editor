// Import Third-party Dependencies
import type {
  Keyboard,
  KeyBindingHandler
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  BRUSH_AXES,
  type BrushAxis,
  type BrushStore,
  type SelectionStore
} from "../../../state/index.ts";

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
    keyboard.bind("KeyR", onVoxelLayer(() => {
      brush.mode = brush.mode === "build" ? "replace" : "build";
    })),
    keyboard.bind("KeyX", onVoxelLayer(() => {
      brush.axis = nextAxis(brush.axis);
    })),
    keyboard.bind("KeyC", onVoxelLayer(() => {
      brush.pattern = brush.pattern === "square" ? "circle" : "square";
    })),
    keyboard.bind("KeyG", onVoxelLayer(() => {
      brush.ghost = !brush.ghost;
    })),
    keyboard.bind("BracketLeft", onVoxelLayer(() => {
      brush.resize(-1);
    }), { repeat: true }),
    keyboard.bind("BracketRight", onVoxelLayer(() => {
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
