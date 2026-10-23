// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import {
  registerKeyBindingReset,
  registerKeyBindingVariable
} from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import type { MapActionGroup } from "./mapActions.ts";

// CONSTANTS
const kGroups: Readonly<Record<MapActionGroup, string>> = {
  tool: "Tool shortcuts",
  edit: "History, clipboard and selection shortcuts",
  brush: "Brush shortcuts",
  orient: "Rotation and mirror shortcuts, for the brush and placements",
  view: "Camera and viewport shortcuts"
};

export interface KeybindsConsoleContext {
  state: Pick<VoxelMapWorkspace["state"], "mapKeyBindings">;
}

export function keybindsConsole(
  commands: CommandConsole,
  { state: { mapKeyBindings } }: KeybindsConsoleContext
): RegistrationHandle {
  const handles: RegistrationHandle[] = [];

  for (const [group, description] of Object.entries(kGroups)) {
    const namespace = commands.registerNamespace(`keybinds.${group}`, {
      description
    });
    handles.push(namespace);

    for (const action of mapKeyBindings.keyBindings.actions) {
      if (action.startsWith(`${group}.`)) {
        registerKeyBindingVariable(
          namespace,
          mapKeyBindings,
          action,
          action.slice(group.length + 1)
        );
      }
    }
  }

  const root = commands.registerNamespace("keybinds", {
    description: "Map keyboard shortcuts"
  });
  handles.push(root);
  registerKeyBindingReset(root, mapKeyBindings);

  return {
    unregister: () => {
      for (const handle of handles.splice(0).reverse()) {
        handle.unregister();
      }
    }
  };
}
