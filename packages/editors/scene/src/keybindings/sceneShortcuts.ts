// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { SceneActions } from "../editing/SceneActions.ts";
import {
  SCENE_HISTORY_SCOPE,
  type SceneHistory
} from "../features/history/sceneHistory.ts";
import type { GizmoSettings } from "../features/viewport/GizmoSettings.ts";
import type { SelectionStore } from "../state/SelectionStore.ts";
import type { SceneAction } from "./sceneActions.ts";

export interface SceneShortcutsOptions {
  history: Pick<SceneHistory, "undo" | "redo">;
  actions: Pick<SceneActions, "duplicateSelection" | "removeSelection">;
  selection: Pick<SelectionStore, "primary">;
  gizmo: GizmoSettings;
  frameSelection(): void;
}

export function sceneShortcuts(
  options: SceneShortcutsOptions
): KeyBindingHandlers<SceneAction> {
  const { history, actions, selection, gizmo } = options;

  return {
    "edit.undo": () => {
      history.undo(SCENE_HISTORY_SCOPE);
    },
    "edit.redo": () => {
      history.redo(SCENE_HISTORY_SCOPE);
    },
    "edit.duplicate": () => {
      if (selection.primary === null) {
        return false;
      }
      actions.duplicateSelection();

      return true;
    },
    "edit.delete": () => {
      if (selection.primary === null) {
        return false;
      }
      actions.removeSelection();

      return true;
    },
    "gizmo.translate": () => {
      gizmo.mode = "translate";
    },
    "gizmo.rotate": () => {
      gizmo.mode = "rotate";
    },
    "gizmo.scale": () => {
      gizmo.mode = "scale";
    },
    "gizmo.space": () => {
      gizmo.toggleSpace();
    },
    "view.frame": () => {
      options.frameSelection();
    }
  };
}
