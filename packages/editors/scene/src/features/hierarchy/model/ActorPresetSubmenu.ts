// Import Third-party Dependencies
import type { MenuBranch } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ActorPreset,
  AddActorAction
} from "./ActorPreset.ts";

export class ActorPresetSubmenu {
  readonly presets: readonly ActorPreset[];
  readonly #label: string;

  constructor(
    label: string,
    presets: readonly ActorPreset[]
  ) {
    this.#label = label;
    this.presets = presets;
  }

  get menuEntry(): MenuBranch<AddActorAction> {
    return {
      id: `group:${this.#label}`,
      label: this.#label,
      icon: this.presets[0].icon,
      items: this.presets.map((preset) => preset.menuEntry)
    };
  }
}
