// Import Third-party Dependencies
import type { MenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ActorPreset,
  AddActorAction
} from "./ActorPreset.ts";

export interface ActorPresetMenuEntry {
  readonly menuEntry: MenuEntry<AddActorAction>;
  readonly presets: readonly ActorPreset[];
}

export class ActorPresetMenu {
  readonly entries: readonly MenuEntry<AddActorAction>[];
  readonly #presets: ReadonlyMap<AddActorAction, ActorPreset>;

  constructor(
    sections: readonly (readonly ActorPresetMenuEntry[])[]
  ) {
    this.entries = sections.flatMap((section, index) => [
      ...index === 0 ? [] : ["separator" as const],
      ...section.map(({ menuEntry }) => menuEntry)
    ]);
    this.#presets = new Map(
      sections
        .flat()
        .flatMap(({ presets }) => presets)
        .map((preset) => [preset.action, preset])
    );
  }

  find(
    action: AddActorAction
  ): ActorPreset | undefined {
    return this.#presets.get(action);
  }
}
