// Import Third-party Dependencies
import type { Keyboard } from "@jolly-pixel/controls";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TemplateStore } from "../../../state/index.ts";

export type TemplateShortcutCode = "KeyQ" | "KeyE";

// CONSTANTS
const kTransformByCode: Readonly<
  Record<TemplateShortcutCode, VoxelTransformOptions>
> = {
  KeyQ: { rotation: 1 },
  KeyE: { rotation: 3 }
};
const kCodes: readonly TemplateShortcutCode[] = ["KeyQ", "KeyE"];

export interface TemplateShortcutsOptions {
  keyboard: Pick<Keyboard, "on" | "off">;
  templates: TemplateStore;
}

export class TemplateShortcuts {
  #keyboard: Pick<Keyboard, "on" | "off">;
  #templates: TemplateStore;

  #onKey = (
    event: KeyboardEvent
  ): void => {
    const code = kCodes.find((candidate) => candidate === event.code);
    if (
      code === undefined ||
      !this.#templates.placing ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    ) {
      return;
    }

    this.#templates.transformPlacement(kTransformByCode[code]);
    event.preventDefault();
  };

  constructor(
    options: TemplateShortcutsOptions
  ) {
    this.#keyboard = options.keyboard;
    this.#templates = options.templates;

    for (const code of kCodes) {
      this.#keyboard.on(code, this.#onKey);
    }
  }

  dispose(): void {
    for (const code of kCodes) {
      this.#keyboard.off(code, this.#onKey);
    }
  }
}
