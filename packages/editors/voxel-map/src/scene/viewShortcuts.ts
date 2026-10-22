// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { EditorMap } from "../map/EditorMap.ts";
import type { MapLayers } from "../features/layers/MapLayers.ts";
import {
  INSPECTOR_MODES,
  type SelectionStore,
  type ViewStore
} from "../state/index.ts";
import type { EditorCamera } from "./camera/EditorCamera.ts";
import { SpawnPose } from "./camera/SpawnPose.ts";
import type { MapGroupAction } from "../keybindings/mapActions.ts";

export interface ViewShortcutsOptions {
  view: Pick<ViewStore, "settings" | "update">;
  camera: Pick<EditorCamera, "frame">;
  world: Pick<VoxelWorld, "getLayers">;
  layers: Pick<MapLayers, "bounds">;
  selection: Pick<SelectionStore, "current">;
}

export function viewShortcuts(
  options: ViewShortcutsOptions
): KeyBindingHandlers<MapGroupAction<"view">> {
  const {
    view,
    camera,
    world,
    layers,
    selection
  } = options;

  function frame(): void {
    const selected = selection.current === null ?
      null :
      layers.bounds(selection.current);

    camera.frame(
      selected ?? SpawnPose.unionBounds(EditorMap.layers(world))
    );
  }

  function nextInspector(): void {
    const index = INSPECTOR_MODES.indexOf(view.settings.inspector);

    view.update({
      inspector: INSPECTOR_MODES[(index + 1) % INSPECTOR_MODES.length]
    });
  }

  return {
    "view.frame": frame,
    "view.grid": () => {
      view.update({ grid: !view.settings.grid });
    },
    "view.glow": () => {
      view.update({ glow: !view.settings.glow });
    },
    "view.chunkBounds": () => {
      view.update({ chunkBounds: !view.settings.chunkBounds });
    },
    "view.inspector": nextInspector
  };
}
