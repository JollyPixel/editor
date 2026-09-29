// Import Third-party Dependencies
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TemplateStore } from "../TemplateStore.ts";
import {
  bindKeys,
  type KeyBindingTarget
} from "../../../shared/keyBindings.ts";

export interface TemplateShortcutsOptions {
  keyboard: KeyBindingTarget;
  templates: TemplateStore;
}

export function bindTemplateShortcuts(
  options: TemplateShortcutsOptions
): () => void {
  const { templates } = options;

  return bindKeys(options.keyboard, ["KeyQ", "KeyE"], (event) => {
    if (
      !templates.placing ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    ) {
      return;
    }

    const transform: VoxelTransformOptions = event.code === "KeyQ" ?
      { rotation: 1 } :
      { rotation: 3 };
    templates.transformPlacement(transform);
    event.preventDefault();
  });
}
