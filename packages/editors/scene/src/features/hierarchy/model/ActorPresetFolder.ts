// Import Third-party Dependencies
import type { SceneActorCategoryInfo } from "@jolly-pixel/editor.host/scene";
import type {
  MenuBranch,
  MenuEntry,
  MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ActorPreset,
  AddActorAction
} from "./ActorPreset.ts";

export class ActorPresetFolder {
  readonly presets: readonly ActorPreset[];
  readonly #category: SceneActorCategoryInfo;
  readonly #sections: readonly (readonly ActorPreset[])[];

  constructor(
    category: SceneActorCategoryInfo,
    sections: readonly (readonly ActorPreset[])[]
  ) {
    this.#category = category;
    this.#sections = sections;
    this.presets = sections.flat();
  }

  get menuEntry(): MenuItem<AddActorAction> | MenuBranch<AddActorAction> {
    const [first] = this.presets;
    if (this.presets.length === 1) {
      return first.menuEntry;
    }

    return {
      id: `category:${this.#category.id}`,
      label: this.#category.label,
      icon: first.icon,
      items: this.#items()
    };
  }

  #items(): MenuEntry<AddActorAction>[] {
    const blocks = [
      ...this.#sections.filter((section) => section.length > 1),
      this.#sections.filter((section) => section.length === 1).flat()
    ].filter((block) => block.length > 0);

    return blocks.flatMap((block, index) => [
      ...index === 0 ? [] : ["separator" as const],
      ...block.map((preset) => preset.menuEntry)
    ]);
  }
}
