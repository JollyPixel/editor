// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";
import type { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import type { SceneActions } from "../editing/SceneActions.ts";
import type { ActorMover } from "../features/viewport/ActorMover.ts";
import type { GizmoSettings } from "../features/viewport/GizmoSettings.ts";
import { SCENE_PREFERENCES } from "../preferences.ts";
import type { SceneAction } from "./sceneActions.ts";

export interface SceneShortcutsOptions {
  actions: Pick<
    SceneActions,
    | "undo"
    | "redo"
    | "canEditSelection"
    | "duplicateSelection"
    | "removeSelection"
  >;
  gizmo: GizmoSettings;
  preferences: Pick<Preferences, "values" | "update">;
  mover: Pick<ActorMover, "dropToGround">;
  frameSelection(): void;
}

export function sceneShortcuts(
  options: SceneShortcutsOptions
): KeyBindingHandlers<SceneAction> {
  const {
    actions,
    gizmo,
    preferences
  } = options;

  return {
    "edit.undo": () => {
      actions.undo();
    },
    "edit.redo": () => {
      actions.redo();
    },
    "edit.duplicate": () => {
      if (!actions.canEditSelection()) {
        return false;
      }
      actions.duplicateSelection();

      return true;
    },
    "edit.delete": () => {
      if (!actions.canEditSelection()) {
        return false;
      }
      actions.removeSelection();

      return true;
    },
    "edit.dropToGround": () => options.mover.dropToGround(),
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
    "gizmo.snap": () => {
      const { snap } = preferences.values(SCENE_PREFERENCES);
      preferences.update(SCENE_PREFERENCES, { snap: !snap });
    },
    "view.frame": () => {
      options.frameSelection();
    }
  };
}
