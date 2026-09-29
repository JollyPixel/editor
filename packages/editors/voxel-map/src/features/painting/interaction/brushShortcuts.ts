// Import Internal Dependencies
import {
  BRUSH_AXES,
  type BrushAxis,
  type BrushStore,
  type SelectionStore
} from "../../../state/index.ts";
import {
  bindKeys,
  type KeyBindingTarget
} from "../../../shared/keyBindings.ts";

export interface BrushShortcutsOptions {
  keyboard: KeyBindingTarget;
  brush: BrushStore;
  selection: SelectionStore;
}

export function bindBrushShortcuts(
  options: BrushShortcutsOptions
): () => void {
  const { brush, selection } = options;
  const codes = ["KeyR", "KeyX", "KeyC", "KeyG", "BracketLeft", "BracketRight"] as const;

  return bindKeys(options.keyboard, codes, (event) => {
    const resizing = event.code === "BracketLeft" || event.code === "BracketRight";
    if (
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey ||
      (event.repeat && !resizing) ||
      selection.voxelLayer === null
    ) {
      return;
    }

    switch (event.code) {
      case "KeyR":
        brush.mode = brush.mode === "build" ? "replace" : "build";
        break;
      case "KeyX":
        brush.axis = nextAxis(brush.axis);
        break;
      case "KeyC":
        brush.pattern = brush.pattern === "square" ? "circle" : "square";
        break;
      case "KeyG":
        brush.ghost = !brush.ghost;
        break;
      case "BracketLeft":
        brush.resize(-1);
        break;
      case "BracketRight":
        brush.resize(1);
        break;
      default:
        return;
    }

    event.preventDefault();
  });
}

function nextAxis(
  axis: BrushAxis
): BrushAxis {
  const index = BRUSH_AXES.indexOf(axis);

  return BRUSH_AXES[(index + 1) % BRUSH_AXES.length];
}
